from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.campaign import Campaign, CampaignStatus
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse
from app.utils.auth import get_current_user
import asyncio


def _run_scrape_in_background(campaign_id: int):
    """Run scraping task directly without Celery (dev mode)."""
    from app.workers.scraping_tasks import scrape_google_maps
    try:
        scrape_google_maps(campaign_id)
    except Exception as e:
        import structlog
        structlog.get_logger().error("Background scrape failed", campaign_id=campaign_id, error=str(e))

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=List[CampaignResponse])
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Campaign).filter(Campaign.owner_id == current_user.id).order_by(Campaign.created_at.desc()).all()


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = Campaign(owner_id=current_user.id, **payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = _get_owned(campaign_id, current_user.id, db)
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = _get_owned(campaign_id, current_user.id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = _get_owned(campaign_id, current_user.id, db)
    db.delete(campaign)
    db.commit()


@router.post("/{campaign_id}/start")
def start_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activate a campaign and kick off the scraping job."""
    campaign = _get_owned(campaign_id, current_user.id, db)
    if campaign.status == CampaignStatus.active:
        raise HTTPException(status_code=400, detail="Campaign already active")

    campaign.status = CampaignStatus.active
    db.commit()

    # Run scraping in background (works without Celery in dev mode)
    background_tasks.add_task(_run_scrape_in_background, campaign_id)
    return {"message": "Campaign started — scraping in progress", "campaign_id": campaign_id}


@router.post("/{campaign_id}/pause")
def pause_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = _get_owned(campaign_id, current_user.id, db)
    campaign.status = CampaignStatus.paused
    db.commit()
    return {"message": "Campaign paused"}


def _get_owned(campaign_id: int, user_id: int, db: Session) -> Campaign:
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.owner_id == user_id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign
