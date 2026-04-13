# =============================================================================
# FinWatch Zambia — Financial Record Schema
# =============================================================================

from pydantic import BaseModel, field_validator


class FinancialRecordRequest(BaseModel):
    """
    Raw financial statement inputs submitted by the user.
    All monetary values must be positive (or zero).
    The ratio engine derives the 10 feature ratios from these inputs.
    """

    period: str  # e.g. "2024" or "2024-Q3"

    # Balance Sheet
    current_assets: float
    current_liabilities: float
    total_assets: float
    total_liabilities: float
    total_equity: float
    inventory: float
    cash_and_equivalents: float
    retained_earnings: float

    # Income Statement
    revenue: float
    net_income: float
    ebit: float
    interest_expense: float

    @field_validator(
        "current_assets",
        "current_liabilities",
        "total_assets",
        "total_liabilities",
        "total_equity",
        "inventory",
        "cash_and_equivalents",
        "revenue",
    )
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Financial values cannot be negative.")
        return v

    @field_validator("total_assets")
    @classmethod
    def assets_must_be_positive(cls, v: float) -> float:
        if v == 0:
            raise ValueError("Total assets cannot be zero.")
        return v
