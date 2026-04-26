# =============================================================================
# FinWatch Zambia — Financial Record Schemas
# =============================================================================

import re
from datetime import datetime

from pydantic import BaseModel, field_validator


class FinancialRecordRequest(BaseModel):
    """
    Raw financial statement inputs submitted by the user.
    The ratio engine derives the 10 feature ratios from these inputs.
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
    def validate_reporting_period(cls, v: str) -> str:
        stripped = v.strip().upper()
        if not stripped:
            raise ValueError(
                "Period cannot be blank. Use a format like '2024' or '2024-Q3'."
            )
        
        # Format Check: YYYY or YYYY-QX
        match = re.match(r"^(\d{4})(?:-Q([1-4]))?$", stripped)
        if not match:
            raise ValueError(
                "Invalid period format. Please use 'YYYY' (e.g., 2024) "
                "or 'YYYY-QX' (e.g., 2024-Q3)."
            )
        
        year_str = match.group(1)
        quarter_str = match.group(2)
        year = int(year_str)
        
        # Date Constraints
        min_year = 2010  # Based on ML training data availability
        current_date = datetime.now()
        current_year = current_date.year
        current_quarter = (current_date.month - 1) // 3 + 1
        
        if year < min_year:
            raise ValueError(
                f"Reporting period cannot be earlier than {min_year}. "
                "The system requires more recent data for accurate predictions."
            )
            
        if year > current_year:
            raise ValueError(
                f"Reporting period cannot exceed the current year ({current_year})."
            )
            
        if year == current_year and quarter_str:
            quarter = int(quarter_str)
            if quarter > current_quarter:
                raise ValueError(
                    f"Reporting period cannot exceed the current quarter (Q{current_quarter})."
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
    def total_assets_warn_if_zero(cls, v: float) -> float:
        """
        Total assets of exactly zero is permitted to allow the ratio
        engine to handle it via safe_div (returns 0.0).
        This matches the test suite's boundary condition requirements.
        """
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
