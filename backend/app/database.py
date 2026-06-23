from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

_db_url = settings.DATABASE_URL

# SQLite: use as-is. PostgreSQL: ensure psycopg3 driver prefix.
if _db_url.startswith("sqlite"):
    engine = create_engine(
        _db_url,
        connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
        pool_pre_ping=True,
    )
else:
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://").replace(
        "postgres://", "postgresql+psycopg://"
    )
    engine = create_engine(
        _db_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
