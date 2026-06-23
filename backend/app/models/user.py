from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaigns = relationship("Campaign", back_populates="owner", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # WhatsApp
    whatsapp_api_token = Column(String(500))
    whatsapp_phone_id = Column(String(100))
    my_whatsapp_number = Column(String(50))

    # Email
    smtp_host = Column(String(255))
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String(255))
    smtp_password = Column(String(500))
    from_email = Column(String(255))
    from_name = Column(String(255))

    # AI Prompts
    whatsapp_prompt_template = Column(Text)
    email_prompt_template = Column(Text)
    followup_prompt_template = Column(Text)
    objection_prompt_template = Column(Text)
    ai_system_prompt = Column(Text)

    # Pricing Packages
    packages_json = Column(Text)  # JSON array of packages

    # Notifications
    notify_on_reply = Column(Boolean, default=True)
    notify_on_hot_lead = Column(Boolean, default=True)
    notify_on_deal = Column(Boolean, default=True)
    notification_whatsapp = Column(String(50))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="settings")
