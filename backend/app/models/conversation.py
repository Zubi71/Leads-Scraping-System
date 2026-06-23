from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class MessageSender(str, enum.Enum):
    ai = "ai"
    human = "human"         # business owner (prospect)
    operator = "operator"   # manual override by user


class ConversationStage(str, enum.Enum):
    initial_outreach = "initial_outreach"
    engaged = "engaged"
    objection_handling = "objection_handling"
    pricing_discussion = "pricing_discussion"
    booking = "booking"
    closed_won = "closed_won"
    closed_lost = "closed_lost"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, unique=True, index=True)

    stage = Column(SAEnum(ConversationStage), default=ConversationStage.initial_outreach)
    is_ai_active = Column(Boolean, default=True)    # False = operator took over
    is_resolved = Column(Boolean, default=False)

    # Intent scoring (0-100)
    intent_score = Column(Integer, default=0)

    # Context window for AI (serialized JSON)
    ai_context = Column(Text)

    started_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime)
    resolved_at = Column(DateTime)

    lead = relationship("Lead", back_populates="conversation")
    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)

    sender = Column(SAEnum(MessageSender), nullable=False)
    content = Column(Text, nullable=False)
    channel = Column(String(50))  # whatsapp / email

    # AI metadata
    ai_model = Column(String(100))
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
