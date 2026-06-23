"""
CSV bulk import endpoint.
Accepts a CSV with columns: business_name, phone, email, whatsapp, website,
address, city, country, category, rating, review_count
"""

import csv
import io
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.lead import Lead, LeadStatus
from app.models.campaign import Campaign
from app.models.user import User
from app.utils.auth import get_current_user
from app.utils.helpers import normalize_phone, is_valid_email, clean_business_name

router = APIRouter(prefix="/import", tags=["import"])

REQUIRED_COLUMNS = {"business_name"}
OPTIONAL_COLUMNS = {
    "phone", "email", "whatsapp", "website",
    "address", "city", "country", "category",
    "rating", "review_count",
}


@router.post("/csv/{campaign_id}")
async def import_csv(
    campaign_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify campaign ownership
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.owner_id == current_user.id,
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Empty CSV file")

    # Normalize column names
    headers = {h.strip().lower().replace(" ", "_") for h in reader.fieldnames}
    if not REQUIRED_COLUMNS.issubset(headers):
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain column: business_name. Found: {list(headers)}",
        )

    imported = 0
    skipped = 0
    errors: List[str] = []

    for i, row in enumerate(reader, start=2):
        # Normalize keys
        row = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items() if k}

        name = row.get("business_name", "").strip()
        if not name:
            skipped += 1
            continue

        # Skip duplicate by phone or email within same campaign
        phone = normalize_phone(row.get("phone", ""))
        email = row.get("email", "").strip() or None
        if email and not is_valid_email(email):
            email = None

        existing = None
        if phone:
            existing = db.query(Lead).filter(
                Lead.campaign_id == campaign_id,
                Lead.phone == phone,
            ).first()
        if not existing and email:
            existing = db.query(Lead).filter(
                Lead.campaign_id == campaign_id,
                Lead.email == email,
            ).first()

        if existing:
            skipped += 1
            continue

        try:
            rating = float(row["rating"]) if row.get("rating") else None
            review_count = int(row["review_count"]) if row.get("review_count") else 0
        except ValueError:
            rating = None
            review_count = 0

        lead = Lead(
            campaign_id=campaign_id,
            business_name=clean_business_name(name),
            phone=phone,
            whatsapp=normalize_phone(row.get("whatsapp", "")) or phone,
            email=email,
            website=row.get("website") or None,
            address=row.get("address") or None,
            city=row.get("city") or campaign.city,
            country=row.get("country") or campaign.country,
            category=row.get("category") or campaign.niche,
            rating=rating,
            review_count=review_count,
            status=LeadStatus.queued,
        )
        db.add(lead)
        imported += 1

    db.flush()
    campaign.total_leads = (campaign.total_leads or 0) + imported
    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "message": f"Successfully imported {imported} leads ({skipped} skipped as duplicates)",
    }


@router.get("/template")
def download_template():
    """Return CSV column headers for the import template."""
    from fastapi.responses import Response
    headers = "business_name,phone,whatsapp,email,website,address,city,country,category,rating,review_count\n"
    sample = "Joe's Salon,+601234567890,+601234567890,joe@example.com,,123 Main St,Kuala Lumpur,Malaysia,salon,4.5,120\n"
    return Response(
        content=headers + sample,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=import_template.csv"},
    )
