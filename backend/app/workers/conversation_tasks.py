"""
Celery tasks for AI conversation handling and deal detection.
"""

import asyncio
import json
from datetime import datetime
from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.models.lead import Lead, LeadStatus, OutreachChannel
from app.models.conversation import Conversation, ConversationMessage, MessageSender, ConversationStage
from app.models.deal import Deal
from app.models.campaign import Campaign
from app.services.ai_agent import ai_agent
from app.services.whatsapp import whatsapp_service
from app.services.email_service import email_service
from app.services.notification import notification_service
import structlog

logger = structlog.get_logger()


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=2)
def handle_incoming_message(self, lead_id: int, incoming_text: str, channel: str):
    """
    Called when a prospect replies.
    Saves their message, generates AI reply, sends it, checks for deal/opt-out.
    """
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return

        # Opt-out detection
        opt_out_keywords = ["stop", "unsubscribe", "remove me", "don't contact", "not interested anymore"]
        if any(kw in incoming_text.lower() for kw in opt_out_keywords):
            lead.opted_out = True
            lead.opted_out_at = datetime.utcnow()
            lead.status = LeadStatus.rejected
            db.commit()
            logger.info("Lead opted out", lead_id=lead_id)
            return

        # Get or create conversation
        conv = lead.conversation
        if not conv:
            conv = Conversation(lead_id=lead_id)
            db.add(conv)
            db.flush()

        # Save incoming message
        human_msg = ConversationMessage(
            conversation_id=conv.id,
            sender=MessageSender.human,
            content=incoming_text,
            channel=channel,
        )
        db.add(human_msg)

        # Update lead status
        lead.status = LeadStatus.replied
        lead.reply_count = (lead.reply_count or 0) + 1
        lead.last_contact_at = datetime.utcnow()
        conv.last_message_at = datetime.utcnow()
        db.commit()

        campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()

        # If operator took over, don't auto-reply
        if not conv.is_ai_active:
            return

        # Build conversation history for AI
        history = _build_history(conv)

        # Build lead context
        context = _build_context(lead, campaign)

        # Get AI reply
        result = ai_agent.generate_reply(
            conversation_history=history,
            lead_context=context,
            language=campaign.language if campaign else "English",
        )

        # Save AI reply
        ai_msg = ConversationMessage(
            conversation_id=conv.id,
            sender=MessageSender.ai,
            content=result["message"],
            channel=channel,
        )
        db.add(ai_msg)

        # Update intent score
        conv.intent_score = result["intent_score"]

        # Notify if high intent
        if result["intent_score"] >= 75 and not lead.is_hot_lead:
            lead.is_hot_lead = True
            run_async(notification_service.notify_hot_lead(
                business_name=lead.business_name,
                intent_score=result["intent_score"],
                lead_id=lead.id,
            ))

        # Handle deal confirmation
        if result["deal_confirmed"]:
            _close_deal(db, lead, conv, campaign)
        elif result["opt_out"]:
            lead.opted_out = True
            lead.opted_out_at = datetime.utcnow()
            lead.status = LeadStatus.rejected
        else:
            lead.status = LeadStatus.interested if result["intent_score"] > 60 else LeadStatus.replied
            _update_stage(conv, result["intent_score"])

        db.commit()

        # Send AI reply
        try:
            if channel == "whatsapp":
                phone = lead.whatsapp or lead.phone
                run_async(whatsapp_service.send_text(phone, result["message"]))
            else:
                run_async(email_service.send(
                    to_email=lead.email,
                    subject=f"Re: Website for {lead.business_name}",
                    body_text=result["message"],
                ))
        except Exception as send_err:
            logger.error("Failed to send AI reply", lead_id=lead_id, error=str(send_err))

        # Notify operator about new reply
        run_async(notification_service.notify_new_reply(
            business_name=lead.business_name,
            message_preview=incoming_text,
            lead_id=lead.id,
        ))

    except Exception as exc:
        db.rollback()
        logger.error("Conversation task failed", lead_id=lead_id, error=str(exc))
        self.retry(exc=exc)
    finally:
        db.close()


def _build_history(conv: Conversation) -> list:
    history = []
    for msg in conv.messages[-20:]:  # keep last 20 messages for context
        role = "assistant" if msg.sender in (MessageSender.ai, MessageSender.operator) else "user"
        history.append({"role": role, "content": msg.content})
    return history


def _build_context(lead: Lead, campaign) -> str:
    return (
        f"Business: {lead.business_name}\n"
        f"Category: {lead.category}\n"
        f"Location: {lead.city}, {lead.country}\n"
        f"Rating: {lead.rating}/5 ({lead.review_count} reviews)\n"
        f"Website status: {lead.website_quality.value if lead.website_quality else 'unknown'}\n"
        f"Package offered: {campaign.package_name if campaign else 'Professional Website'} "
        f"at ${campaign.package_price if campaign else 'TBD'}\n"
        f"Replies so far: {lead.reply_count}"
    )


def _close_deal(db, lead: Lead, conv: Conversation, campaign):
    lead.status = LeadStatus.closed
    conv.stage = ConversationStage.closed_won
    conv.is_resolved = True
    conv.resolved_at = datetime.utcnow()

    deal = Deal(
        lead_id=lead.id,
        campaign_id=lead.campaign_id,
        client_name=lead.business_name,
        business_name=lead.business_name,
        contact_phone=lead.phone,
        contact_email=lead.email,
        contact_whatsapp=lead.whatsapp,
        package_name=campaign.package_name if campaign else None,
        package_price=campaign.package_price if campaign else None,
    )
    db.add(deal)
    db.flush()

    if campaign:
        campaign.deals_closed = (campaign.deals_closed or 0) + 1

    run_async(notification_service.notify_deal_closed(
        client_name=deal.client_name,
        business_name=deal.business_name,
        phone=deal.contact_phone,
        package=deal.package_name,
        price=deal.package_price,
        deal_id=deal.id,
    ))


def _update_stage(conv: Conversation, intent_score: int):
    if intent_score >= 80:
        conv.stage = ConversationStage.pricing_discussion
    elif intent_score >= 60:
        conv.stage = ConversationStage.engaged
    elif intent_score < 30:
        conv.stage = ConversationStage.objection_handling
