from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.campaign import Campaign
from app.models.deal import Deal
from app.models.conversation import Conversation
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def get_overview(
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = (
        db.query(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )
    if campaign_id:
        base = base.filter(Lead.campaign_id == campaign_id)

    total_leads = base.count()
    contacted = base.filter(Lead.status.in_([
        LeadStatus.contacted, LeadStatus.replied, LeadStatus.interested,
        LeadStatus.meeting_booked, LeadStatus.closed,
    ])).count()
    replied = base.filter(Lead.status.in_([
        LeadStatus.replied, LeadStatus.interested, LeadStatus.meeting_booked, LeadStatus.closed,
    ])).count()
    interested = base.filter(Lead.status.in_([
        LeadStatus.interested, LeadStatus.meeting_booked, LeadStatus.closed,
    ])).count()
    closed = base.filter(Lead.status == LeadStatus.closed).count()
    rejected = base.filter(Lead.status == LeadStatus.rejected).count()
    hot_leads = base.filter(Lead.is_hot_lead == True).count()

    # Today's stats
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_contacted = base.filter(Lead.first_contact_at >= today_start).count()

    deal_query = (
        db.query(Deal)
        .join(Lead, Deal.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )
    total_revenue = db.query(func.sum(Deal.package_price)).filter(
        Deal.lead_id.in_([d.lead_id for d in deal_query.all()])
    ).scalar() or 0

    reply_rate = round((replied / contacted * 100) if contacted > 0 else 0, 1)
    conversion_rate = round((closed / total_leads * 100) if total_leads > 0 else 0, 1)

    return {
        "total_leads": total_leads,
        "contacted": contacted,
        "replied": replied,
        "interested": interested,
        "closed_deals": closed,
        "rejected": rejected,
        "hot_leads": hot_leads,
        "today_contacted": today_contacted,
        "total_revenue": total_revenue,
        "reply_rate": reply_rate,
        "conversion_rate": conversion_rate,
    }


@router.get("/daily")
def get_daily_stats(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns daily contacted/replied/closed counts for the chart."""
    start_date = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(
            func.date(Lead.first_contact_at).label("date"),
            func.count(Lead.id).label("contacted"),
        )
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(
            Campaign.owner_id == current_user.id,
            Lead.first_contact_at >= start_date,
        )
        .group_by(func.date(Lead.first_contact_at))
        .order_by(func.date(Lead.first_contact_at))
        .all()
    )

    return [{"date": str(row.date), "contacted": row.contacted} for row in rows]


@router.get("/by-niche")
def get_by_niche(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Conversion rate grouped by niche."""
    campaigns = db.query(Campaign).filter(Campaign.owner_id == current_user.id).all()
    result = []
    for c in campaigns:
        leads = db.query(Lead).filter(Lead.campaign_id == c.id).count()
        closed = db.query(Lead).filter(
            Lead.campaign_id == c.id, Lead.status == LeadStatus.closed
        ).count()
        result.append({
            "niche": c.niche,
            "campaign": c.name,
            "leads": leads,
            "closed": closed,
            "conversion": round(closed / leads * 100, 1) if leads > 0 else 0,
        })
    return result


@router.get("/revenue-projection")
def get_revenue_projection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Project monthly revenue based on pipeline."""
    deal_query = (
        db.query(Deal)
        .join(Lead, Deal.lead_id == Lead.id)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )
    confirmed = deal_query.filter(Deal.status == "confirmed").count()
    in_dev = deal_query.filter(Deal.status == "in_development").count()
    paid = deal_query.filter(Deal.status == "paid").count()

    avg_price = db.query(func.avg(Deal.package_price)).scalar() or 0

    return {
        "pipeline_value": round((confirmed + in_dev) * avg_price, 2),
        "earned_revenue": round(paid * avg_price, 2),
        "avg_deal_value": round(avg_price, 2),
        "deals_in_pipeline": confirmed + in_dev,
    }
