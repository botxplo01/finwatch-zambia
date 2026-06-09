"""
FinWatch Zambia - Authentication Attempt Rate Limiter

Per-user, database-backed rate limiting for successful login completions.
Tracks how many times a user has fully authenticated within a rolling
1-hour window and enforces a 2-hour lockout after 5 completions.

This is intentionally separate from the IP-based rate_limit.py which
handles endpoint-level throttling for a different threat model.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import (
    AUTH_ATTEMPT_LIMIT,
    AUTH_LOCKOUT_SECONDS,
    AUTH_WINDOW_SECONDS,
)
from app.models.user import User

logger = logging.getLogger(__name__)


def check_and_record_auth_attempt(db: Session, user: User) -> None:
    """
    Check whether the user is currently locked out, then record a new
    successful authentication attempt.

    Call this AFTER the user is identified and BEFORE the JWT is issued.
    This function mutates user fields and calls db.flush() but does NOT
    commit — the caller owns the transaction.

    Raises:
        HTTPException 429: If the user is currently locked out, or if
                           this attempt causes the limit to be exceeded.
    """
    now = datetime.now(timezone.utc)

    # 1. Check active lockout
    if user.auth_locked_until is not None:
        locked_until = user.auth_locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            remaining_seconds = int((locked_until - now).total_seconds())
            remaining_minutes = (remaining_seconds + 59) // 60
            logger.warning(
                "Login blocked — user_id=%d is locked out for %d more minutes.",
                user.id,
                remaining_minutes,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Too many login attempts. Your account is temporarily "
                    f"locked. Please try again in {remaining_minutes} "
                    f"minute{'s' if remaining_minutes != 1 else ''}."
                ),
                headers={"Retry-After": str(remaining_seconds)},
            )
        else:
            user.auth_locked_until = None
            user.auth_attempt_count = 0
            user.auth_window_start = None

    # 2. Check whether the rolling window has elapsed
    window_start = user.auth_window_start
    if window_start is not None and window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=timezone.utc)

    if (
        window_start is None
        or (now - window_start).total_seconds() > AUTH_WINDOW_SECONDS
    ):
        user.auth_attempt_count = 1
        user.auth_window_start = now
        user.auth_locked_until = None
        db.flush()
        logger.info(
            "Auth window reset for user_id=%d. Attempt 1/%d.",
            user.id,
            AUTH_ATTEMPT_LIMIT,
        )
        return

    # 3. Increment attempt count within the active window
    user.auth_attempt_count = (user.auth_attempt_count or 0) + 1

    logger.info(
        "Auth attempt recorded for user_id=%d. Count: %d/%d in window.",
        user.id,
        user.auth_attempt_count,
        AUTH_ATTEMPT_LIMIT,
    )

    # 4. Enforce the limit
    if user.auth_attempt_count > AUTH_ATTEMPT_LIMIT:
        locked_until = now + timedelta(seconds=AUTH_LOCKOUT_SECONDS)
        user.auth_locked_until = locked_until
        user.auth_attempt_count = 0
        user.auth_window_start = None
        db.flush()

        logger.warning(
            "User user_id=%d exceeded AUTH_ATTEMPT_LIMIT (%d). " "Locked out until %s.",
            user.id,
            AUTH_ATTEMPT_LIMIT,
            locked_until.isoformat(),
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many login attempts. Your account has been temporarily "
                "locked for 2 hours for security purposes. "
                "Please try again later."
            ),
            headers={"Retry-After": str(AUTH_LOCKOUT_SECONDS)},
        )

    db.flush()
