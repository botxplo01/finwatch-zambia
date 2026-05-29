"""
FinWatch Zambia - QR Session Model

Tracks temporary tokens for "Scan to Login" synchronization.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class QRSession(Base):
    __tablename__ = "qr_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # The random token displayed in the QR code
    token: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )

    # Status: pending, approved, expired, consumed
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    # Linked user once approved
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )

    # The portal they are trying to access
    portal_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Final JWT issued to the web client
    access_token: Mapped[str | None] = mapped_column(String(511), nullable=True)

    # Capture the browser's User-Agent string
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", backref="qr_sessions")

    def __repr__(self) -> str:
        return f"<QRSession status={self.status} token={self.token[:8]}...>"
