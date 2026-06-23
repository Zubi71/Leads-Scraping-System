import re
import phonenumbers
from typing import Optional
import tldextract
import validators


def normalize_phone(phone: str, default_region: str = "US") -> Optional[str]:
    """Normalize phone to E.164 format, or return None if invalid."""
    if not phone:
        return None
    try:
        parsed = phonenumbers.parse(phone, default_region)
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return phone.strip() or None


def is_valid_email(email: str) -> bool:
    return bool(validators.email(email))


def is_valid_url(url: str) -> bool:
    return bool(validators.url(url))


def extract_domain(url: str) -> Optional[str]:
    if not url:
        return None
    extracted = tldextract.extract(url)
    if extracted.domain:
        return f"{extracted.domain}.{extracted.suffix}"
    return None


def clean_business_name(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip()


def paginate(query, page: int, size: int):
    """Return paginated query + total count."""
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    pages = (total + size - 1) // size
    return items, total, pages
