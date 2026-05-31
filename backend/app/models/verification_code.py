"""
FinWatch Zambia - Verification Code Model

Tracks OTP sessions for email verification during signup and login.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class VerificationCode(Base):
    __tablename__ = "verification_codes"
    __table_args__ = (
        UniqueConstraint("email", "portal_type", name="uq_verification_email_portal"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # user_id is optional because we might be verifying an email before the user is fully created (signup)
    # or we use it for existing users (login)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    portal_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Store hashed code for security
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Store registration data for signup flows (JSON string)
    signup_payload: Mapped[str | None] = mapped_column(String(2047), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Security tracking
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    resend_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_resend_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", backref="verification_codes")

    def __repr__(self) -> str:
        return f"<VerificationCode email={self.email!r} portal={self.portal_type!r} expires_at={self.expires_at}>"
