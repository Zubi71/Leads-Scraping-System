"""
Celery tasks for sending outreach messages and follow-ups.
"""

import asyncio
import time
from datetime import datetime, timedelta
from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.models.campaign import Campaign
from app.models.lead import Lead, LeadStatus, OutreachMessage, OutreachChannel, MessageStatus
from app.models.conversation import Conversation, ConversationMessage, MessageSender
from app.services.ai_agent import ai_agent
from app.services.whatsapp import whatsapp_service, WhatsAppError
from app.services.email_service import email_service, EmailError
from app.utils.rate_limiter import check_whatsapp_rate, check_email_rate
from app.config import settings
import structlog

logger = structlog.get_logger()


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task()
def process_outreach_queue():
    """Process pending leads from all active campaigns."""
    db = SessionLocal()
    try:
        queued_leads = (
            db.query(Lead)
            .join(Campaign, Lead.campaign_id == Campaign.id)
            .filter(
                Lead.status == LeadStatus.queued,
                Lead.opted_out == False,
                Campaign.status == "active",
            )
            .limit(50)
            .all()
        )

        for lead in queued_leads:
            send_initial_outreach.delay(lead.id)

        logger.info("Queued outreach tasks", count=len(queued_leads))
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def send_initial_outreach(self, lead_id: int):
    """Generate and send the first outreach message to a lead."""
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or lead.opted_out or lead.status != LeadStatus.queued:
            return

        campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()
        if not campaign:
            return

        website_status = (
            f"{lead.website_quality.value} website" if lead.website_quality else "no website"
        )

        # Email-only mode — only use email channel
        channel = None
        if lead.email:
            channel = OutreachChannel.email

        if not channel:
            lead.status = LeadStatus.failed
            db.commit()
            return

        # Generate message
        if channel == OutreachChannel.whatsapp:
            content = ai_agent.generate_whatsapp_proposal(
                business_name=lead.business_name,
                niche=campaign.niche,
                city=lead.city or campaign.city,
                country=lead.country or campaign.country,
                rating=lead.rating,
                reviews=lead.review_count,
                website_status=website_status,
                package_name=campaign.package_name or "Professional Website",
                price=campaign.package_price or 499,
                language=campaign.language,
            )
        else:
            email_data = ai_agent.generate_email_proposal(
                business_name=lead.business_name,
                niche=campaign.niche,
                city=lead.city or campaign.city,
                country=lead.country or campaign.country,
                rating=lead.rating,
                reviews=lead.review_count,
                website_status=website_status,
                package_name=campaign.package_name or "Professional Website",
                price=campaign.package_price or 499,
                language=campaign.language,
            )

        # Save outreach message record
        outreach = OutreachMessage(
            lead_id=lead.id,
            channel=channel,
            message_type="initial",
            content=content if channel == OutreachChannel.whatsapp else email_data["body"],
            subject=email_data.get("subject") if channel == OutreachChannel.email else None,
            status=MessageStatus.pending,
        )
        db.add(outreach)
        db.flush()

        # Create conversation record
        if not lead.conversation:
            conv = Conversation(lead_id=lead.id)
            db.add(conv)
            db.flush()

            ai_msg = ConversationMessage(
                conversation_id=conv.id,
                sender=MessageSender.ai,
                content=outreach.content,
                channel=channel.value,
            )
            db.add(ai_msg)

        # Send message
        try:
            if channel == OutreachChannel.whatsapp:
                phone = lead.whatsapp or lead.phone
                result = run_async(whatsapp_service.send_text(phone, outreach.content))
            else:
                result = run_async(email_service.send(
                    to_email=lead.email,
                    subject=email_data["subject"],
                    body_text=email_data["body"],
                ))

            outreach.status = MessageStatus.sent
            outreach.sent_at = datetime.utcnow()
            outreach.external_message_id = result.get("message_id")

            lead.status = LeadStatus.contacted
            lead.outreach_channel = channel
            lead.first_contact_at = datetime.utcnow()
            lead.last_contact_at = datetime.utcnow()

            campaign.leads_contacted = (campaign.leads_contacted or 0) + 1

        except (WhatsAppError, EmailError) as send_err:
            outreach.status = MessageStatus.failed
            outreach.failed_reason = str(send_err)
            lead.status = LeadStatus.failed
            logger.error("Outreach send failed", lead_id=lead_id, error=str(send_err))

        db.commit()
        time.sleep(settings.OUTREACH_DELAY_SECONDS)

    except Exception as exc:
        logger.error("Outreach task error", lead_id=lead_id, error=str(exc))
        db.rollback()
        self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task()
def send_follow_ups():
    """Send follow-up #1 (day 3) and #2 (day 7) to non-responsive leads."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        for days_since, follow_up_num in [(3, 1), (7, 2)]:
            cutoff = now - timedelta(days=days_since)
            leads = (
                db.query(Lead)
                .join(Campaign, Lead.campaign_id == Campaign.id)
                .filter(
                    Lead.status == LeadStatus.contacted,
                    Lead.last_contact_at <= cutoff,
                    Lead.opted_out == False,
                    Campaign.status == "active",
                )
                .all()
            )

            for lead in leads:
                existing_followups = (
                    db.query(OutreachMessage)
                    .filter(
                        OutreachMessage.lead_id == lead.id,
                        OutreachMessage.message_type == f"followup_{follow_up_num}",
                    )
                    .count()
                )
                if existing_followups == 0:
                    send_follow_up_message.delay(lead.id, follow_up_num)

    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2)
def send_follow_up_message(self, lead_id: int, follow_up_number: int):
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead or lead.opted_out:
            return

        # Get original message for context
        original = (
            db.query(OutreachMessage)
            .filter(OutreachMessage.lead_id == lead_id, OutreachMessage.message_type == "initial")
            .first()
        )
        original_content = original.content if original else ""

        campaign = db.query(Campaign).filter(Campaign.id == lead.campaign_id).first()

        content = ai_agent.generate_follow_up(
            business_name=lead.business_name,
            follow_up_number=follow_up_number,
            original_message=original_content,
            language=campaign.language if campaign else "English",
        )

        channel = lead.outreach_channel or OutreachChannel.whatsapp
        outreach = OutreachMessage(
            lead_id=lead.id,
            channel=channel,
            message_type=f"followup_{follow_up_number}",
            content=content,
            status=MessageStatus.pending,
        )
        db.add(outreach)
        db.flush()

        try:
            if channel == OutreachChannel.whatsapp:
                phone = lead.whatsapp or lead.phone
                result = run_async(whatsapp_service.send_text(phone, content))
            else:
                result = run_async(email_service.send(
                    to_email=lead.email,
                    subject=f"Following up — {lead.business_name}",
                    body_text=content,
                ))

            outreach.status = MessageStatus.sent
            outreach.sent_at = datetime.utcnow()
            lead.last_contact_at = datetime.utcnow()

        except Exception as send_err:
            outreach.status = MessageStatus.failed
            outreach.failed_reason = str(send_err)

        db.commit()

    except Exception as exc:
        db.rollback()
        self.retry(exc=exc)
    finally:
        db.close()
