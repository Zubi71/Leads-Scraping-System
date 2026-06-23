from celery import Celery
from celery.schedules import crontab
from app.config import settings

# Use in-memory broker when Redis isn't configured (dev mode)
_broker = settings.REDIS_URL if settings.REDIS_URL != "redis://localhost:6379/0" else "memory://"
_backend = settings.REDIS_URL if _broker != "memory://" else "cache+memory://"

celery_app = Celery(
    "ai_leads",
    broker=_broker,
    backend=_backend,
    include=[
        "app.workers.scraping_tasks",
        "app.workers.outreach_tasks",
        "app.workers.conversation_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,  # 24 hours

    # Rate limits per task
    task_annotations={
        "app.workers.outreach_tasks.send_whatsapp_message": {"rate_limit": "20/h"},
        "app.workers.outreach_tasks.send_email_message": {"rate_limit": "50/h"},
        "app.workers.scraping_tasks.scrape_google_maps": {"rate_limit": "10/m"},
    },

    # Beat schedule for periodic tasks
    beat_schedule={
        "process-outreach-queue": {
            "task": "app.workers.outreach_tasks.process_outreach_queue",
            "schedule": crontab(minute="*/5"),
        },
        "send-follow-ups": {
            "task": "app.workers.outreach_tasks.send_follow_ups",
            "schedule": crontab(hour="9", minute="0"),
        },
        "refresh-lead-website-status": {
            "task": "app.workers.scraping_tasks.refresh_website_checks",
            "schedule": crontab(hour="2", minute="0"),
        },
    },
    beat_scheduler="celery.beat:PersistentScheduler",
)
