# =============================================================================
# FinWatch Zambia — Prediction & Narrative Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel


class RatioFeatureResponse(BaseModel):
    current_ratio: float
    quick_ratio: float
    cash_ratio: float
    debt_to_equity: float
    debt_to_assets: float
    interest_coverage: float
    net_profit_margin: float
    return_on_assets: float
    return_on_equity: float
    asset_turnover: float

    model_config = {"from_attributes": True}


class NarrativeResponse(BaseModel):
    content: str
    source: str  # "groq" | "ollama" | "template"
    generated_at: datetime

    model_config = {"from_attributes": True}


class PredictionResponse(BaseModel):
    id: int
    model_used: str
    risk_label: str
    distress_probability: float
    shap_values: dict[str, float]
    predicted_at: datetime
    ratios: RatioFeatureResponse | None = None
    narrative: NarrativeResponse | None = None

    model_config = {"from_attributes": True}


class PredictionSummaryResponse(BaseModel):
    """Lightweight response for history listing — no SHAP or narrative."""

    id: int
    model_used: str
    risk_label: str
    distress_probability: float
    predicted_at: datetime
    company_name: str

    model_config = {"from_attributes": True}
