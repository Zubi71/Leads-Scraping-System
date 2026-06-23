from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class DealStatus(str, enum.Enum):
    confirmed = "confirmed"
    in_development = "in_development"
    delivered = "delivered"
    invoiced = "invoiced"
    paid = "paid"
    cancelled = "cancelled"


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False, unique=True, index=True)
    campaign_id = Column(Integer, nullable=False, index=True)

    # Client Details
    client_name = Column(String(500), nullable=False)
    business_name = Column(String(500), nullable=False)
    contact_phone = Column(String(50))
    contact_email = Column(String(255))
    contact_whatsapp = Column(String(50))

    # Package
    package_name = Column(String(255))
    package_price = Column(Float)
    currency = Column(String(10), default="USD")
    custom_notes = Column(Text)

    # Status
    status = Column(SAEnum(DealStatus), default=DealStatus.confirmed, nullable=False, index=True)

    # Dates
    confirmed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    development_started_at = Column(DateTime)
    delivered_at = Column(DateTime)
    paid_at = Column(DateTime)

    # Notification
    notification_sent = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lead = relationship("Lead", back_populates="deal")
