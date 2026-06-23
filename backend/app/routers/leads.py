from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.models.lead import Lead, LeadStatus, WebsiteQuality
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.lead import LeadResponse, LeadUpdate, LeadListResponse, OutreachMessageResponse
from app.utils.auth import get_current_user
from app.utils.helpers import paginate

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("/", response_model=LeadListResponse)
def list_leads(
    campaign_id: Optional[int] = None,
    status: Optional[LeadStatus] = None,
    website_quality: Optional[WebsiteQuality] = None,
    is_hot: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )

    if campaign_id:
        query = query.filter(Lead.campaign_id == campaign_id)
    if status:
        query = query.filter(Lead.status == status)
    if website_quality:
        query = query.filter(Lead.website_quality == website_quality)
    if is_hot is not None:
        query = query.filter(Lead.is_hot_lead == is_hot)
    if search:
        query = query.filter(Lead.business_name.ilike(f"%{search}%"))

    query = query.order_by(Lead.created_at.desc())
    items, total, pages = paginate(query, page, size)
    return LeadListResponse(items=items, total=total, page=page, size=size, pages=pages)


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_lead(lead_id, current_user.id, db)


@router.patch("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = _get_owned_lead(lead_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/opt-out")
def opt_out_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually opt out a lead from all future communications."""
    from datetime import datetime
    lead = _get_owned_lead(lead_id, current_user.id, db)
    lead.opted_out = True
    lead.opted_out_at = datetime.utcnow()
    lead.status = LeadStatus.opted_out
    db.commit()
    return {"message": "Lead opted out successfully"}


@router.get("/{lead_id}/messages", response_model=List[OutreachMessageResponse])
def get_lead_messages(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = _get_owned_lead(lead_id, current_user.id, db)
    return lead.outreach_messages


def _get_owned_lead(lead_id: int, user_id: int, db: Session) -> Lead:
    lead = (
        db.query(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Lead.id == lead_id, Campaign.owner_id == user_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead
