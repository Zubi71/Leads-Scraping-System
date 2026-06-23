from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.conversation import MessageSender, ConversationStage


class ConversationMessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender: MessageSender
    content: str
    channel: Optional[str]
    ai_model: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    lead_id: int
    stage: ConversationStage
    is_ai_active: bool
    is_resolved: bool
    intent_score: int
    started_at: datetime
    last_message_at: Optional[datetime]
    messages: List[ConversationMessageResponse] = []

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str
    channel: str = "whatsapp"


class TakeoverRequest(BaseModel):
    reason: Optional[str] = None
