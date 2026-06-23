from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    niche = Column(String(100), nullable=False)        # e.g. "salons", "restaurants"
    country = Column(String(100), nullable=False)
    city = Column(String(255), nullable=False)
    area = Column(String(255))
    language = Column(String(50), default="English")

    # Targeting
    target_no_website = Column(Boolean, default=True)
    target_poor_website = Column(Boolean, default=True)
    target_outdated_website = Column(Boolean, default=False)
    target_mobile_unfriendly = Column(Boolean, default=False)

    # Pricing
    package_name = Column(String(100))
    package_price = Column(Float)
    package_description = Column(Text)

    # Limits
    max_leads = Column(Integer, default=100)
    max_messages_per_day = Column(Integer, default=20)

    # Status
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.draft, nullable=False)

    # Stats (denormalized for speed)
    total_leads = Column(Integer, default=0)
    leads_contacted = Column(Integer, default=0)
    leads_replied = Column(Integer, default=0)
    leads_interested = Column(Integer, default=0)
    deals_closed = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run_at = Column(DateTime)

    owner = relationship("User", back_populates="campaigns")
    leads = relationship("Lead", back_populates="campaign", cascade="all, delete-orphan")
