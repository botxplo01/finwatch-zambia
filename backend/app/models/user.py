"""
FinWatch Zambia - User Model

Roles:
- sme_owner: Default role, accesses /dashboard
- policy_analyst: Read-only regulator portal access
- regulator: Full regulator portal access including exports
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

VALID_ROLES = {"sme_owner", "policy_analyst", "regulator"}
VALID_PORTALS = {"sme", "institutional"}


class User(Base):
    __tablename__ = "users"
    # Enforce portal isolation by scoping email uniqueness constraints to each specific portal domain, preventing login conflicts between SME owners and Regulators.
    __table_args__ = (
        UniqueConstraint("email", "portal_type", name="uq_user_email_portal"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped[str] = mapped_column(
        String(30), default="sme_owner", nullable=False, server_default="sme_owner"
    )

    portal_type: Mapped[str] = mapped_column(
        String(20), default="sme", nullable=False, server_default="sme"
    )

    business_scale: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )

    onboarding_complete: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="0"
    )

    profile_picture_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )
    original_profile_picture_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    auth_attempt_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    auth_window_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    auth_locked_until: Mapped[datetime | None] = mapped_column(
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

    companies: Mapped[list["Company"]] = relationship(  # noqa: F821
        "Company", back_populates="owner", cascade="all, delete-orphan"
    )

    ai_usage_logs: Mapped[list["AIUsageLog"]] = relationship(  # noqa: F821
        "AIUsageLog", back_populates="user", cascade="all, delete-orphan"
    )

    device_sessions: Mapped[list["UserDeviceSession"]] = relationship(  # noqa: F821
        "UserDeviceSession", back_populates="user", cascade="all, delete-orphan"
    )

    chat_conversations: Mapped[list["ChatConversation"]] = relationship(  # noqa: F821
        "ChatConversation",
        back_populates="user",
        cascade="all, delete-orphan",
    )


    @property
    def is_regulator_role(self) -> bool:
        """True for both policy_analyst and regulator roles."""
        return self.role in ("policy_analyst", "regulator")

    @property
    def is_full_regulator(self) -> bool:
        """True only for the full regulator role (export access)."""
        return self.role == "regulator"

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"
