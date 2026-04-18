# =============================================================================
# FinWatch Zambia — Auth Service
#
# Reusable user-lookup and auth utility functions.
# The auth router handles HTTP concerns (request parsing, response formatting).
# This module handles the business logic that may be needed across
# multiple routers (e.g. admin router also needs get_user_by_id).
# =============================================================================

import logging

from sqlalchemy.orm import Session

from app.models.user import User

logger = logging.getLogger(__name__)


def get_user_by_email(email: str, db: Session) -> User | None:
    """
    Fetch a user by email address.

    Email is normalised to lowercase before querying to match the
    storage convention set in the auth router (all emails stored lowercase).

    Args:
        email: Raw email string (case-insensitive).
        db:    Active SQLAlchemy session.

    Returns:
        User object if found, None otherwise.
    """
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(user_id: int, db: Session) -> User | None:
    """
    Fetch a user by primary key.

    Args:
        user_id: Integer primary key.
        db:      Active SQLAlchemy session.

    Returns:
        User object if found, None otherwise.
    """
    return db.query(User).filter(User.id == user_id).first()


def is_email_available(
    email: str, db: Session, exclude_user_id: int | None = None
) -> bool:
    """
    Check whether an email address is available for registration or update.

    Args:
        email:           The email to check.
        db:              Active SQLAlchemy session.
        exclude_user_id: If provided, the user with this ID is excluded from
                         the uniqueness check — used during profile updates
                         so a user can "re-submit" their own email without
                         triggering a false conflict.

    Returns:
        True if the email is available, False if already taken.
    """
    query = db.query(User).filter(User.email == email.lower().strip())
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is None


def get_active_user_count(db: Session) -> int:
    """Return the total number of active user accounts."""
    return db.query(User).filter(User.is_active == True).count()  # noqa: E712
