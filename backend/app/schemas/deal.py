from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.deal import DealStatus


class DealUpdate(BaseModel):
    status: Optional[DealStatus] = None
    custom_notes: Optional[str] = None
    development_started_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class DealResponse(BaseModel):
    id: int
    lead_id: int
    campaign_id: int
    client_name: str
    business_name: str
    contact_phone: Optional[str]
    contact_email: Optional[str]
    contact_whatsapp: Optional[str]
    package_name: Optional[str]
    package_price: Optional[float]
    currency: str
    custom_notes: Optional[str]
    status: DealStatus
    confirmed_at: datetime
    development_started_at: Optional[datetime]
    delivered_at: Optional[datetime]
    paid_at: Optional[datetime]
    notification_sent: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
