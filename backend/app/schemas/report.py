# =============================================================================
# FinWatch Zambia — Report Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel


class ReportGenerateResponse(BaseModel):
    """Returned by POST /api/reports/{prediction_id}"""

    detail: str
    report_id: int
    filename: str
    generated_at: str  # ISO string — router returns .isoformat()


class ReportListItem(BaseModel):
    """Single item returned by GET /api/reports/"""

    report_id: int
    prediction_id: int
    company_name: str
    filename: str
    generated_at: str  # ISO string

    model_config = {"from_attributes": True}
