# =============================================================================
# FinWatch Zambia — Financial Record Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel, field_validator


class FinancialRecordRequest(BaseModel):
    """
    Raw financial statement inputs submitted by the user.
    The ratio engine derives the 10 feature ratios from these inputs.

    Sign conventions (critical for correct ratio computation):
      Non-negative fields: current_assets, current_liabilities, total_assets,
        total_liabilities, total_equity, inventory, cash_and_equivalents,
        revenue, interest_expense — these are always >= 0 by definition.

      Signed fields (may be negative — these are key distress signals):
        retained_earnings — negative if the firm has accumulated losses
        net_income        — negative if the firm made a net loss this period
        ebit              — negative if operating expenses exceed revenue
    """

    period: str  # e.g. "2024" or "2024-Q3"

    # -------------------------------------------------------------------------
    # Balance Sheet — non-negative fields
    # -------------------------------------------------------------------------
    current_assets: float
    current_liabilities: float
    total_assets: float
    total_liabilities: float
    total_equity: float
    inventory: float
    cash_and_equivalents: float

    # Signed — accumulated losses produce negative retained earnings
    retained_earnings: float

    # -------------------------------------------------------------------------
    # Income Statement
    # -------------------------------------------------------------------------
    revenue: float

    # Signed — a net loss produces a negative net_income
    net_income: float

    # Signed — operating losses produce negative EBIT
    ebit: float

    # Non-negative — interest expense is always a positive cost
    interest_expense: float

    # -------------------------------------------------------------------------
    # Validators
    # -------------------------------------------------------------------------

    @field_validator("period")
    @classmethod
    def period_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError(
                "Period cannot be blank. Use a format like '2024' or '2024-Q3'."
            )
        return stripped

    @field_validator(
        "current_assets",
        "current_liabilities",
        "total_assets",
        "total_liabilities",
        "total_equity",
        "inventory",
        "cash_and_equivalents",
        "revenue",
        "interest_expense",
    )
    @classmethod
    def must_be_non_negative(cls, v: float) -> float:
        """
        Enforce non-negativity for balance sheet and income statement items
        that cannot logically be negative. Note: retained_earnings, net_income,
        and ebit are intentionally excluded — they are signed values that carry
        meaningful financial information when negative.
        """
        if v < 0:
            raise ValueError(
                "This field cannot be negative. "
                "For signed values (net income, EBIT, retained earnings), "
                "use the dedicated fields which accept negative numbers."
            )
        return v

    @field_validator("total_assets")
    @classmethod
    def total_assets_must_be_positive(cls, v: float) -> float:
        """
        Total assets must be strictly positive.
        Division by total_assets appears in multiple ratio formulas —
        a zero value would cause division by zero in the ratio engine.
        """
        if v == 0:
            raise ValueError(
                "Total assets cannot be zero. "
                "The ratio engine uses total assets as a denominator."
            )
        return v

    @field_validator("total_equity")
    @classmethod
    def total_equity_warn_if_zero(cls, v: float) -> float:
        """
        Total equity of exactly zero is technically valid (fully debt-financed)
        but produces an undefined debt-to-equity ratio. The ratio engine
        handles this via safe_div (returns 0.0), which is acceptable.
        Negative equity (liabilities exceed assets) is permitted — this is
        a significant distress signal and must not be blocked.
        """
        return v


class FinancialRecordResponse(BaseModel):
    """
    Full financial record response including all raw inputs.
    Returned by GET /api/companies/{id}/records.
    """

    id: int
    company_id: int
    period: str
    current_assets: float
    current_liabilities: float
    total_assets: float
    total_liabilities: float
    total_equity: float
    inventory: float
    cash_and_equivalents: float
    retained_earnings: float
    revenue: float
    net_income: float
    ebit: float
    interest_expense: float
    created_at: datetime

    model_config = {"from_attributes": True}
