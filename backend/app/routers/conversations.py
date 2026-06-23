from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.lead import Lead
from app.models.campaign import Campaign
from app.models.conversation import Conversation, ConversationMessage, MessageSender
from app.models.user import User
from app.schemas.conversation import ConversationResponse, SendMessageRequest, TakeoverRequest
from app.utils.auth import get_current_user
from app.services.whatsapp import whatsapp_service
from app.workers.conversation_tasks import handle_incoming_message
from app.config import settings
import hmac
import hashlib
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/", response_model=List[ConversationResponse])
def list_conversations(
    is_active: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Conversation)
        .join(Lead, Conversation.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
        .order_by(Conversation.last_message_at.desc())
        .all()
    )


@router.get("/{conv_id}", response_model=ConversationResponse)
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_conv(conv_id, current_user.id, db)


@router.post("/{conv_id}/send")
def send_manual_message(
    conv_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Operator manually sends a message in a conversation."""
    from datetime import datetime
    import asyncio

    conv = _get_owned_conv(conv_id, current_user.id, db)
    lead = conv.lead

    # Save operator message
    msg = ConversationMessage(
        conversation_id=conv.id,
        sender=MessageSender.operator,
        content=payload.content,
        channel=payload.channel,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.commit()

    # Send via channel
    try:
        loop = asyncio.new_event_loop()
        if payload.channel == "whatsapp":
            phone = lead.whatsapp or lead.phone
            loop.run_until_complete(whatsapp_service.send_text(phone, payload.content))
        loop.close()
    except Exception as e:
        logger.error("Manual message send failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Send failed: {str(e)}")

    return {"message": "Sent"}


@router.post("/{conv_id}/takeover")
def takeover_conversation(
    conv_id: int,
    payload: TakeoverRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable AI for this conversation so operator handles it manually."""
    conv = _get_owned_conv(conv_id, current_user.id, db)
    conv.is_ai_active = False
    db.commit()
    return {"message": "AI disabled for this conversation. You are now in control."}


@router.post("/{conv_id}/resume-ai")
def resume_ai(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-enable AI for a conversation after manual takeover."""
    conv = _get_owned_conv(conv_id, current_user.id, db)
    conv.is_ai_active = True
    db.commit()
    return {"message": "AI re-enabled for this conversation"}


# ── WhatsApp Webhook ───────────────────────────────────────────────────────────

@router.get("/webhook/whatsapp")
def verify_whatsapp_webhook(request: Request):
    """Meta webhook verification challenge."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == settings.WHATSAPP_API_TOKEN:
        return int(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook/whatsapp")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive incoming WhatsApp messages and route to AI handler."""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    # Verify webhook signature
    expected = "sha256=" + hmac.new(
        settings.WHATSAPP_API_TOKEN.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()
    parsed = whatsapp_service.parse_incoming_webhook(payload)

    if not parsed:
        return {"status": "ok"}

    from_number = parsed["from"]
    text = parsed["text"]

    if not text:
        return {"status": "ok"}

    # Find lead by phone/whatsapp number
    lead = (
        db.query(Lead)
        .filter((Lead.phone == from_number) | (Lead.whatsapp == from_number))
        .first()
    )

    if lead:
        handle_incoming_message.delay(lead.id, text, "whatsapp")

    return {"status": "ok"}


def _get_owned_conv(conv_id: int, user_id: int, db: Session) -> Conversation:
    conv = (
        db.query(Conversation)
        .join(Lead, Conversation.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Conversation.id == conv_id, Campaign.owner_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
