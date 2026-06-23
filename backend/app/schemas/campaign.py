from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.campaign import CampaignStatus


class CampaignCreate(BaseModel):
    name: str
    niche: str
    country: str
    city: str
    area: Optional[str] = None
    language: str = "English"
    target_no_website: bool = True
    target_poor_website: bool = True
    target_outdated_website: bool = False
    target_mobile_unfriendly: bool = False
    package_name: Optional[str] = None
    package_price: Optional[float] = None
    package_description: Optional[str] = None
    max_leads: int = 100
    max_messages_per_day: int = 20


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    niche: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    language: Optional[str] = None
    target_no_website: Optional[bool] = None
    target_poor_website: Optional[bool] = None
    target_outdated_website: Optional[bool] = None
    target_mobile_unfriendly: Optional[bool] = None
    package_name: Optional[str] = None
    package_price: Optional[float] = None
    package_description: Optional[str] = None
    max_leads: Optional[int] = None
    max_messages_per_day: Optional[int] = None
    status: Optional[CampaignStatus] = None


class CampaignResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    niche: str
    country: str
    city: str
    area: Optional[str]
    language: str
    target_no_website: bool
    target_poor_website: bool
    target_outdated_website: bool
    target_mobile_unfriendly: bool
    package_name: Optional[str]
    package_price: Optional[float]
    package_description: Optional[str]
    max_leads: int
    max_messages_per_day: int
    status: CampaignStatus
    total_leads: int
    leads_contacted: int
    leads_replied: int
    leads_interested: int
    deals_closed: int
    created_at: datetime
    updated_at: Optional[datetime]
    last_run_at: Optional[datetime]

    class Config:
        from_attributes = True
