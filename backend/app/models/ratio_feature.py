# =============================================================================
# FinWatch Zambia — Ratio Feature Model
# Stores the 10 computed financial ratios derived from a FinancialRecord.
# These are the feature vectors fed directly into the ML models.
#
# Ratio groups:
#   Liquidity    — current_ratio, quick_ratio, cash_ratio
#   Leverage     — debt_to_equity, debt_to_assets, interest_coverage
#   Profitability — net_profit_margin, return_on_assets, return_on_equity
#   Activity     — asset_turnover
# =============================================================================

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class RatioFeature(Base):
    __tablename__ = "ratio_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    financial_record_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("financial_records.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # -------------------------------------------------------------------------
    # Liquidity Ratios
    # -------------------------------------------------------------------------
    current_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    # (Current Assets - Inventory) / Current Liabilities
    quick_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    # Cash & Equivalents / Current Liabilities
    cash_ratio: Mapped[float] = mapped_column(Float, nullable=False)

    # -------------------------------------------------------------------------
    # Leverage Ratios
    # -------------------------------------------------------------------------
    # Total Liabilities / Total Equity
    debt_to_equity: Mapped[float] = mapped_column(Float, nullable=False)
    # Total Liabilities / Total Assets
    debt_to_assets: Mapped[float] = mapped_column(Float, nullable=False)
    # EBIT / Interest Expense
    interest_coverage: Mapped[float] = mapped_column(Float, nullable=False)

    # -------------------------------------------------------------------------
    # Profitability Ratios
    # -------------------------------------------------------------------------
    # Net Income / Revenue
    net_profit_margin: Mapped[float] = mapped_column(Float, nullable=False)
    # Net Income / Total Assets
    return_on_assets: Mapped[float] = mapped_column(Float, nullable=False)
    # Net Income / Total Equity
    return_on_equity: Mapped[float] = mapped_column(Float, nullable=False)

    # -------------------------------------------------------------------------
    # Activity Ratios
    # -------------------------------------------------------------------------
    # Revenue / Total Assets
    asset_turnover: Mapped[float] = mapped_column(Float, nullable=False)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    financial_record: Mapped["FinancialRecord"] = relationship(  # noqa: F821
        "FinancialRecord", back_populates="ratio_feature"
    )
    prediction: Mapped["Prediction | None"] = relationship(  # noqa: F821
        "Prediction", back_populates="ratio_feature", uselist=False
    )

    def __repr__(self) -> str:
        return f"<RatioFeature id={self.id} record_id={self.financial_record_id}>"
