"""
FinWatch Zambia - Prediction & Narrative Schemas
"""

from datetime import datetime

from pydantic import BaseModel, field_validator


class PredictionCreateRequest(BaseModel):
    """Request body for POST /api/predictions/."""

    company_id: int
    record_id: int
    model_name: str = "random_forest"

    model_config = {"protected_namespaces": ()}

    @field_validator("model_name")
    @classmethod
    def valid_model_name(cls, v: str) -> str:
        allowed = {"random_forest", "logistic_regression"}
        if v not in allowed:
            raise ValueError(
                f"model_name must be one of: {', '.join(sorted(allowed))}."
            )
        return v


class RatioFeatureResponse(BaseModel):
    """The 10 computed financial ratios for a prediction."""

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
    computed_at: datetime

    model_config = {"from_attributes": True}


class NarrativeResponse(BaseModel):
    """Embedded narrative view returned within a PredictionResponse."""

    content: str
    source: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class PredictionResponse(BaseModel):
    """Full prediction response including SHAP values and NLP narrative."""

    id: int
    model_used: str
    risk_label: str
    distress_probability: float
    shap_values: dict[str, float]
    predicted_at: datetime
    assessment_methodology: str
    ratios: RatioFeatureResponse | None = None
    narrative: NarrativeResponse | None = None
    inputs: "FinancialRecordResponse | None" = None

    model_config = {"from_attributes": True, "protected_namespaces": ()}


# Forward reference for circular imports
from app.schemas.financial_record import FinancialRecordResponse

PredictionResponse.model_rebuild()


class PredictionSummaryResponse(BaseModel):
    """Lightweight prediction response for history listing."""

    id: int
    company_id: int
    company_name: str
    period: str
    model_used: str
    risk_label: str
    distress_probability: float
    predicted_at: datetime
    assessment_methodology: str

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class PaginatedPredictionResponse(BaseModel):
    """Paginated wrapper for prediction summaries."""

    items: list[PredictionSummaryResponse]
    total: int
    skip: int
    limit: int


class AssessmentResponse(BaseModel):
    """Combined dual-model assessment result for a single financial record."""

    ratio_feature_id: int
    company_id: int
    company_name: str
    period: str
    assessment_methodology: str
    random_forest: PredictionResponse | None = None
    logistic_regression: PredictionResponse | None = None
    models_agree: bool | None = None
    predicted_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class AssessmentSummaryResponse(BaseModel):
    """Lightweight assessment row for the paginated list endpoint."""

    ratio_feature_id: int
    company_id: int
    company_name: str
    period: str
    assessment_methodology: str
    random_forest_risk_label: str | None = None
    random_forest_probability: float | None = None
    logistic_regression_risk_label: str | None = None
    logistic_regression_probability: float | None = None
    models_agree: bool | None = None
    predicted_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class PaginatedAssessmentResponse(BaseModel):
    """Paginated wrapper for assessment summaries (one row per financial record)."""

    items: list[AssessmentSummaryResponse]
    total: int
    skip: int
    limit: int
