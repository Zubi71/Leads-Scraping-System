from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


class UserSettingsUpdate(BaseModel):
    whatsapp_api_token: Optional[str] = None
    whatsapp_phone_id: Optional[str] = None
    my_whatsapp_number: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    whatsapp_prompt_template: Optional[str] = None
    email_prompt_template: Optional[str] = None
    followup_prompt_template: Optional[str] = None
    objection_prompt_template: Optional[str] = None
    ai_system_prompt: Optional[str] = None
    packages_json: Optional[str] = None
    notify_on_reply: Optional[bool] = None
    notify_on_hot_lead: Optional[bool] = None
    notify_on_deal: Optional[bool] = None
    notification_whatsapp: Optional[str] = None


class UserSettingsResponse(BaseModel):
    id: int
    user_id: int
    whatsapp_phone_id: Optional[str]
    my_whatsapp_number: Optional[str]
    from_email: Optional[str]
    from_name: Optional[str]
    notify_on_reply: bool
    notify_on_hot_lead: bool
    notify_on_deal: bool
    notification_whatsapp: Optional[str]
    packages_json: Optional[str]

    class Config:
        from_attributes = True
