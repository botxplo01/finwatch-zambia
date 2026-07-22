"""
FinWatch Zambia - Verification Service

Handles generation, hashing, and validation of 5-digit OTPs.
Supports fixed codes for gov.zm and email.com domains.
"""

import hashlib
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.verification_code import VerificationCode

logger = logging.getLogger(__name__)

CODE_EXPIRY_MINUTES = 5
MAX_RESEND_ATTEMPTS = 3
RESEND_COOLDOWN_HOURS = 1
MAX_VERIFY_ATTEMPTS = 5

def generate_otp() -> str:
    """Generate a random 5-digit numeric code."""
    return "".join([str(random.randint(0, 9)) for _ in range(5)])

def hash_code(code: str) -> str:
    """Hash the OTP code for secure storage."""
    return hashlib.sha256(code.encode()).hexdigest()

def get_fixed_code(email: str) -> Optional[str]:
    """Return environment-locked code for specific domains if configured."""
    email = email.lower()
    if email.endswith("@gov.zm"):
        return getattr(settings, "GOV_EMAIL_CODE", "21435")
    if email.endswith("@email.com"):
        return getattr(settings, "DEMO_EMAIL_CODE", "52143")
    return None

def ensure_utc(dt: datetime) -> datetime:
    """Ensure a datetime object is UTC-aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def initiate_verification(
    db: Session,
    email: str,
    portal_type: str,
    user_id: Optional[int] = None,
    signup_payload: Optional[str] = None,
) -> Tuple[str, datetime]:
    """
    Create or update a verification session for an email + portal combination.
    Returns the raw code and its expiry.
    """
    email = email.lower().strip()
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(minutes=CODE_EXPIRY_MINUTES)

    fixed = get_fixed_code(email)
    raw_code = fixed if fixed else generate_otp()

    code_hash = hash_code(raw_code)

    existing = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email, VerificationCode.portal_type == portal_type
        )
        .first()
    )

    if existing:
        if existing.resend_count >= MAX_RESEND_ATTEMPTS:
            last_resend = ensure_utc(existing.last_resend_at)
            cooldown_end = last_resend + timedelta(hours=RESEND_COOLDOWN_HOURS)
            if now < cooldown_end:
                logger.warning(
                    "Verification resend blocked: Cooldown active for %s (%s)",
                    email,
                    portal_type,
                )
                raise ValueError("COOLDOWN_ACTIVE")

        existing.code_hash = code_hash
        existing.expires_at = expiry
        existing.attempts = 0
        existing.resend_count += 1
        existing.last_resend_at = now
        existing.user_id = user_id or existing.user_id
        if signup_payload:
            existing.signup_payload = signup_payload
    else:
        new_code = VerificationCode(
            email=email,
            portal_type=portal_type,
            user_id=user_id,
            signup_payload=signup_payload,
            code_hash=code_hash,
            expires_at=expiry,
            resend_count=1,
            last_resend_at=now,
        )
        db.add(new_code)

    db.commit()
    logger.info(
        "Verification initiated for %s (%s). Type: %s",
        email,
        portal_type,
        "SIGNUP" if signup_payload else "LOGIN",
    )

    return raw_code, expiry

def verify_otp_and_get_session(
    db: Session, email: str, portal_type: str, code: str
) -> VerificationCode:
    """
    Validate an OTP.
    Returns the VerificationCode record if valid, raises ValueError for failures.
    NOTE: Does NOT delete the record yet, so caller can extract signup_payload.
    """
    email = email.lower().strip()
    now = datetime.now(timezone.utc)

    record = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email, VerificationCode.portal_type == portal_type
        )
        .first()
    )

    if not record:
        raise ValueError("NO_SESSION")

    expires_at = ensure_utc(record.expires_at)
    if expires_at < now:
        raise ValueError("CODE_EXPIRED")

    if record.attempts >= MAX_VERIFY_ATTEMPTS:
        raise ValueError("TOO_MANY_ATTEMPTS")

    if record.code_hash != hash_code(code):
        record.attempts += 1
        db.commit()
        raise ValueError("INVALID_CODE")

    return record
