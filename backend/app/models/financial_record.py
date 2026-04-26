"""
FinWatch Zambia - Financial Record Model

Stores raw financial statement values entered by the user.
These are the inputs from which the 10 financial ratios are derived.

Constraint: UniqueConstraint(company_id, period) ensures one record per reporting period.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class FinancialRecord(Base):
    __tablename__ = "financial_records"

    __table_args__ = (
        UniqueConstraint(
            "company_id", "period", name="uq_financial_record_company_period"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    period: Mapped[str] = mapped_column(String(20), nullable=False)

    current_assets: Mapped[float] = mapped_column(Float, nullable=False)
    current_liabilities: Mapped[float] = mapped_column(Float, nullable=False)
    total_assets: Mapped[float] = mapped_column(Float, nullable=False)
    total_liabilities: Mapped[float] = mapped_column(Float, nullable=False)
    total_equity: Mapped[float] = mapped_column(Float, nullable=False)
    inventory: Mapped[float] = mapped_column(Float, nullable=False)
    cash_and_equivalents: Mapped[float] = mapped_column(Float, nullable=False)

    retained_earnings: Mapped[float] = mapped_column(Float, nullable=False)

    revenue: Mapped[float] = mapped_column(Float, nullable=False)

    net_income: Mapped[float] = mapped_column(Float, nullable=False)

    ebit: Mapped[float] = mapped_column(Float, nullable=False)

    interest_expense: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    company: Mapped["Company"] = relationship(  # noqa: F821
        "Company", back_populates="financial_records"
    )
    ratio_feature: Mapped["RatioFeature | None"] = relationship(  # noqa: F821
        "RatioFeature",
        back_populates="financial_record",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<FinancialRecord id={self.id} "
            f"company_id={self.company_id} period={self.period!r}>"
        )
