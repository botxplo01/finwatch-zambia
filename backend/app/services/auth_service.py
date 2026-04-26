"""
FinWatch Zambia - Auth Service

Reusable user-lookup and auth utility functions.
"""

import logging

from sqlalchemy.orm import Session

from app.models.user import User

logger = logging.getLogger(__name__)


def get_user_by_email(email: str, db: Session) -> User | None:
    """Fetch a user by email address."""
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(user_id: int, db: Session) -> User | None:
    """Fetch a user by primary key."""
    return db.query(User).filter(User.id == user_id).first()


def is_email_available(
    email: str, db: Session, exclude_user_id: int | None = None
) -> bool:
    """Check whether an email address is available for registration or update."""
    query = db.query(User).filter(User.email == email.lower().strip())
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is None


def get_active_user_count(db: Session) -> int:
    """Return the total number of active user accounts."""
    return db.query(User).filter(User.is_active == True).count()  # noqa: E712
