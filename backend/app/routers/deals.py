from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.deal import Deal, DealStatus
from app.models.lead import Lead
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.deal import DealResponse, DealUpdate
from app.utils.auth import get_current_user

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("/", response_model=List[DealResponse])
def list_deals(
    status: Optional[DealStatus] = None,
    campaign_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Deal)
        .join(Lead, Deal.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )
    if status:
        query = query.filter(Deal.status == status)
    if campaign_id:
        query = query.filter(Deal.campaign_id == campaign_id)

    return query.order_by(Deal.confirmed_at.desc()).offset((page - 1) * size).limit(size).all()


@router.get("/{deal_id}", response_model=DealResponse)
def get_deal(
    deal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_owned_deal(deal_id, current_user.id, db)


@router.patch("/{deal_id}", response_model=DealResponse)
def update_deal(
    deal_id: int,
    payload: DealUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = _get_owned_deal(deal_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deal, field, value)
    db.commit()
    db.refresh(deal)
    return deal


def _get_owned_deal(deal_id: int, user_id: int, db: Session) -> Deal:
    deal = (
        db.query(Deal)
        .join(Lead, Deal.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Deal.id == deal_id, Campaign.owner_id == user_id)
        .first()
    )
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal
