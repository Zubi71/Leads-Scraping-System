from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.lead import LeadStatus, WebsiteQuality, OutreachChannel, MessageStatus


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    is_hot_lead: Optional[bool] = None


class OutreachMessageResponse(BaseModel):
    id: int
    lead_id: int
    channel: OutreachChannel
    message_type: Optional[str]
    content: str
    subject: Optional[str]
    status: MessageStatus
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    failed_reason: Optional[str]
    retry_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class LeadResponse(BaseModel):
    id: int
    campaign_id: int
    business_name: str
    category: Optional[str]
    address: Optional[str]
    city: Optional[str]
    country: Optional[str]
    phone: Optional[str]
    whatsapp: Optional[str]
    email: Optional[str]
    website: Optional[str]
    google_maps_url: Optional[str]
    rating: Optional[float]
    review_count: int
    website_quality: Optional[WebsiteQuality]
    website_score: int
    website_analysis_notes: Optional[str]
    status: LeadStatus
    outreach_channel: Optional[OutreachChannel]
    first_contact_at: Optional[datetime]
    last_contact_at: Optional[datetime]
    reply_count: int
    is_hot_lead: bool
    opted_out: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    size: int
    pages: int
