from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.campaign import Campaign
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/outreach", tags=["outreach"])


def _run_outreach(lead_id: int):
    from app.workers.outreach_tasks import send_initial_outreach
    try:
        send_initial_outreach(lead_id)
    except Exception as e:
        import structlog
        structlog.get_logger().error("Outreach task failed", lead_id=lead_id, error=str(e))


def _run_queue():
    from app.workers.outreach_tasks import process_outreach_queue
    try:
        process_outreach_queue()
    except Exception as e:
        import structlog
        structlog.get_logger().error("Queue processing failed", error=str(e))


@router.post("/send/{lead_id}")
def trigger_single_outreach(
    lead_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = (
        db.query(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Lead.id == lead_id, Campaign.owner_id == current_user.id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.opted_out:
        raise HTTPException(status_code=400, detail="Lead has opted out")

    background_tasks.add_task(_run_outreach, lead_id)
    return {"message": f"Outreach triggered for lead #{lead_id}"}


@router.post("/process-queue")
def trigger_process_queue(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    background_tasks.add_task(_run_queue)
    return {"message": "Queue processing triggered"}


@router.get("/stats")
def outreach_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = (
        db.query(Lead)
        .join(Campaign, Lead.campaign_id == Campaign.id)
        .filter(Campaign.owner_id == current_user.id)
    )
    return {
        "queued": base.filter(Lead.status == LeadStatus.queued).count(),
        "contacted_today": base.filter(Lead.status != LeadStatus.scraped).count(),
        "failed": base.filter(Lead.status == LeadStatus.failed).count(),
    }
