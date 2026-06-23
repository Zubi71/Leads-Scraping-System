from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List
import json


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Business Website Acquisition System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    # Defaults to SQLite for easy local dev. Set to postgresql:// for production.
    DATABASE_URL: str = "sqlite:///./leads.db"
    USE_SQLITE: bool = True

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI ────────────────────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    AI_MODEL: str = "moonshotai/kimi-k2.6:free"

    # ── WhatsApp Business API ─────────────────────────────────────────────────
    WHATSAPP_API_URL: str = "https://graph.facebook.com/v19.0"
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""
    MY_WHATSAPP_NUMBER: str = ""

    # ── Email ─────────────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "AI Leads System"

    # ── Google Places ─────────────────────────────────────────────────────────
    GOOGLE_PLACES_API_KEY: Optional[str] = None

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    SCRAPING_DELAY_SECONDS: float = 2.0
    OUTREACH_DELAY_SECONDS: float = 10.0
    MAX_MESSAGES_PER_HOUR: int = 20
    MAX_EMAILS_PER_HOUR: int = 50

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
