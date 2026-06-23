from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class LeadStatus(str, enum.Enum):
    scraped = "scraped"
    queued = "queued"
    contacted = "contacted"
    replied = "replied"
    interested = "interested"
    meeting_booked = "meeting_booked"
    closed = "closed"
    rejected = "rejected"
    opted_out = "opted_out"
    failed = "failed"


class WebsiteQuality(str, enum.Enum):
    none = "none"
    poor = "poor"
    outdated = "outdated"
    mobile_unfriendly = "mobile_unfriendly"
    good = "good"


class OutreachChannel(str, enum.Enum):
    whatsapp = "whatsapp"
    email = "email"
    both = "both"


class MessageStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"
    replied = "replied"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)

    # Business Info
    business_name = Column(String(500), nullable=False)
    category = Column(String(255))
    address = Column(Text)
    city = Column(String(255))
    country = Column(String(100))

    # Contact Info
    phone = Column(String(50))
    whatsapp = Column(String(50))
    email = Column(String(255))
    website = Column(String(500))

    # Google Maps Data
    google_maps_url = Column(String(1000))
    google_place_id = Column(String(255), unique=True, index=True)
    rating = Column(Float)
    review_count = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)

    # Website Analysis
    website_quality = Column(SAEnum(WebsiteQuality), default=WebsiteQuality.none)
    website_score = Column(Integer, default=0)   # 0-100
    website_analysis_notes = Column(Text)
    last_website_check = Column(DateTime)

    # Outreach
    status = Column(SAEnum(LeadStatus), default=LeadStatus.scraped, nullable=False, index=True)
    outreach_channel = Column(SAEnum(OutreachChannel))
    first_contact_at = Column(DateTime)
    last_contact_at = Column(DateTime)
    reply_count = Column(Integer, default=0)
    is_hot_lead = Column(Boolean, default=False)

    # Opt-out / Compliance
    opted_out = Column(Boolean, default=False)
    opted_out_at = Column(DateTime)

    # Notes
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="leads")
    outreach_messages = relationship("OutreachMessage", back_populates="lead", cascade="all, delete-orphan")
    conversation = relationship("Conversation", back_populates="lead", uselist=False, cascade="all, delete-orphan")
    deal = relationship("Deal", back_populates="lead", uselist=False)


class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, index=True)

    channel = Column(SAEnum(OutreachChannel), nullable=False)
    message_type = Column(String(50))  # initial, followup_1, followup_2, etc.
    content = Column(Text, nullable=False)
    subject = Column(String(500))  # for email

    status = Column(SAEnum(MessageStatus), default=MessageStatus.pending)
    external_message_id = Column(String(255))   # WhatsApp/email provider ID

    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    failed_reason = Column(Text)
    retry_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    lead = relationship("Lead", back_populates="outreach_messages")
