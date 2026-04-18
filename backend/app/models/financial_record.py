# =============================================================================
# FinWatch Zambia — Financial Record Model
# Stores raw financial statement values entered by the user.
# These are the inputs from which the 10 financial ratios are derived.
#
# Constraints:
#   UniqueConstraint(company_id, period) — a company cannot have two records
#   for the same reporting period. Enforced both here (DB level) and in the
#   companies router (application level) for defence-in-depth.
# =============================================================================

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class FinancialRecord(Base):
    __tablename__ = "financial_records"

    # Table-level unique constraint: one record per (company, period) pair.
    # The router guards against this at the application layer, but the DB
    # constraint is the true safety net against concurrent duplicate inserts.
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

    # Period identifier — e.g. "2024" or "2024-Q3"
    period: Mapped[str] = mapped_column(String(20), nullable=False)

    # -------------------------------------------------------------------------
    # Balance Sheet Inputs
    # -------------------------------------------------------------------------
    current_assets: Mapped[float] = mapped_column(Float, nullable=False)
    current_liabilities: Mapped[float] = mapped_column(Float, nullable=False)
    total_assets: Mapped[float] = mapped_column(Float, nullable=False)
    total_liabilities: Mapped[float] = mapped_column(Float, nullable=False)
    total_equity: Mapped[float] = mapped_column(Float, nullable=False)
    inventory: Mapped[float] = mapped_column(Float, nullable=False)
    cash_and_equivalents: Mapped[float] = mapped_column(Float, nullable=False)

    # retained_earnings can be negative (accumulated losses are common in
    # distressed SMEs — this is by design, not a data error)
    retained_earnings: Mapped[float] = mapped_column(Float, nullable=False)

    # -------------------------------------------------------------------------
    # Income Statement Inputs
    # -------------------------------------------------------------------------
    revenue: Mapped[float] = mapped_column(Float, nullable=False)

    # net_income can be negative (a net loss is a key distress signal)
    net_income: Mapped[float] = mapped_column(Float, nullable=False)

    # ebit can be negative (operating loss)
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
