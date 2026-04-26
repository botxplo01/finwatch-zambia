"""
FinWatch Zambia - User Model

Roles:
- sme_owner: Default role, accesses /dashboard
- policy_analyst: Read-only regulator portal access
- regulator: Full regulator portal access including exports
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

VALID_ROLES = {"sme_owner", "policy_analyst", "regulator"}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role: Mapped[str] = mapped_column(
        String(30), default="sme_owner", nullable=False, server_default="sme_owner"
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
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

    # Relationships
    companies: Mapped[list["Company"]] = relationship(  # noqa: F821
        "Company", back_populates="owner", cascade="all, delete-orphan"
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
