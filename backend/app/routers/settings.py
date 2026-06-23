from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserSettings
from app.schemas.user import UserSettingsUpdate, UserSettingsResponse, UserResponse, UserUpdate
from app.utils.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/", response_model=UserSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not s:
        s = UserSettings(user_id=current_user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.patch("/", response_model=UserSettingsResponse)
def update_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not s:
        s = UserSettings(user_id=current_user.id)
        db.add(s)
        db.flush()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.post("/test-whatsapp")
async def test_whatsapp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test WhatsApp message to your own number."""
    from app.config import settings as app_settings
    s = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()

    # Check if WhatsApp API is configured
    wa_token = (s.whatsapp_api_token if s else None) or app_settings.WHATSAPP_API_TOKEN
    wa_phone = (s.whatsapp_phone_id if s else None) or app_settings.WHATSAPP_PHONE_ID

    if not wa_token or wa_token == "your_permanent_token":
        raise HTTPException(
            status_code=400,
            detail="WhatsApp API not configured. Add your API Token and Phone ID first. Your notification number is saved."
        )

    from app.services.whatsapp import whatsapp_service
    number = (s.my_whatsapp_number if s else None) or app_settings.MY_WHATSAPP_NUMBER
    if not number:
        raise HTTPException(status_code=400, detail="Notification WhatsApp number not set")

    await whatsapp_service.send_text(number, "✅ Test message from AI Leads System!")
    return {"message": "Test message sent"}


@router.post("/test-email")
async def test_email(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test email to your configured address."""
    from app.services.email_service import email_service, SMTPCredentials
    s = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not s or not s.smtp_username:
        raise HTTPException(status_code=400, detail="SMTP not configured in settings")
    creds = SMTPCredentials.from_user_settings(s)
    await email_service.send(
        to_email=creds.from_email,
        subject="Test Email — AI Leads System",
        body_text="Your email integration is working correctly!",
        credentials=creds,
    )
    return {"message": "Test email sent"}
