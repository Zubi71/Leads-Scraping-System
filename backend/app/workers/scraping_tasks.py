"""
Celery tasks for scraping and website analysis.
"""

import asyncio
from datetime import datetime
from typing import Optional
from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.models.campaign import Campaign, CampaignStatus
from app.models.lead import Lead, LeadStatus, WebsiteQuality
from app.services.scraper import scraper_service
from app.services.website_checker import website_checker
import structlog

logger = structlog.get_logger()


def run_async(coro):
    """Run an async function from a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def scrape_google_maps(self, campaign_id: int):
    """Scrape Google Maps for a campaign and save leads to DB."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            logger.error("Campaign not found", campaign_id=campaign_id)
            return

        campaign.status = CampaignStatus.active
        campaign.last_run_at = datetime.utcnow()
        db.commit()

        businesses = run_async(
            scraper_service.scrape(
                niche=campaign.niche,
                city=campaign.city,
                country=campaign.country,
                max_results=campaign.max_leads,
            )
        )

        new_count = 0
        for biz in businesses:
            # Skip duplicates
            existing = None
            if biz.google_place_id:
                existing = db.query(Lead).filter(
                    Lead.google_place_id == biz.google_place_id
                ).first()

            if existing:
                continue

            lead = Lead(
                campaign_id=campaign_id,
                business_name=biz.business_name,
                category=biz.category or campaign.niche,
                address=biz.address,
                city=biz.city,
                country=biz.country,
                phone=biz.phone,
                email=biz.email,
                website=biz.website,
                rating=biz.rating,
                review_count=biz.review_count,
                google_maps_url=biz.google_maps_url,
                google_place_id=biz.google_place_id,
                status=LeadStatus.scraped,
            )
            db.add(lead)
            new_count += 1

        campaign.total_leads = (campaign.total_leads or 0) + new_count
        db.commit()

        logger.info("Scraping complete", campaign_id=campaign_id, new_leads=new_count)

        # Queue website checks for new leads
        check_websites_for_campaign.delay(campaign_id)

    except Exception as exc:
        logger.error("Scraping task failed", campaign_id=campaign_id, error=str(exc))
        self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2)
def check_websites_for_campaign(self, campaign_id: int):
    """Analyse websites for all unanalysed leads in a campaign."""
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return

        leads = (
            db.query(Lead)
            .filter(
                Lead.campaign_id == campaign_id,
                Lead.last_website_check.is_(None),
            )
            .all()
        )

        for lead in leads:
            try:
                analysis = run_async(website_checker.analyze(lead.website))
                lead.website_quality = analysis.quality
                lead.website_score = analysis.score
                lead.website_analysis_notes = "; ".join(analysis.notes)
                lead.last_website_check = datetime.utcnow()

                # Filter: only queue leads that match campaign targeting
                should_target = (
                    (campaign.target_no_website and analysis.quality == WebsiteQuality.none) or
                    (campaign.target_poor_website and analysis.quality == WebsiteQuality.poor) or
                    (campaign.target_outdated_website and analysis.quality == WebsiteQuality.outdated) or
                    (campaign.target_mobile_unfriendly and analysis.quality == WebsiteQuality.mobile_unfriendly)
                )

                if should_target and lead.status == LeadStatus.scraped:
                    lead.status = LeadStatus.queued

            except Exception as e:
                logger.warning("Website check failed for lead", lead_id=lead.id, error=str(e))

        db.commit()
        logger.info("Website checks done", campaign_id=campaign_id, checked=len(leads))

    except Exception as exc:
        self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task()
def refresh_website_checks():
    """Daily task: re-check websites for leads that haven't been rechecked in 30 days."""
    from datetime import timedelta
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=30)
        stale_leads = (
            db.query(Lead)
            .filter(Lead.last_website_check < cutoff, Lead.status == LeadStatus.queued)
            .limit(200)
            .all()
        )
        for lead in stale_leads:
            check_single_website.delay(lead.id)
        logger.info("Queued website refreshes", count=len(stale_leads))
    finally:
        db.close()


@celery_app.task()
def check_single_website(lead_id: int):
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return
        analysis = run_async(website_checker.analyze(lead.website))
        lead.website_quality = analysis.quality
        lead.website_score = analysis.score
        lead.website_analysis_notes = "; ".join(analysis.notes)
        lead.last_website_check = datetime.utcnow()
        db.commit()
    finally:
        db.close()
