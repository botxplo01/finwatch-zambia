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

    # Liquidity
    current_ratio: float
    quick_ratio: float
    cash_ratio: float
    # Leverage
    debt_to_equity: float
    debt_to_assets: float
    interest_coverage: float
    # Profitability
    net_profit_margin: float
    return_on_assets: float
    return_on_equity: float
    # Activity
    asset_turnover: float
    # Metadata
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
    ratios: RatioFeatureResponse | None = None
    narrative: NarrativeResponse | None = None

    model_config = {"from_attributes": True}


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

    model_config = {"from_attributes": True}


class PaginatedPredictionResponse(BaseModel):
    """Paginated wrapper for prediction summaries."""

    items: list[PredictionSummaryResponse]
    total: int
    skip: int
    limit: int




class ModelComparisonResponse(BaseModel):
    """Side-by-side comparison of Logistic Regression and Random Forest predictions."""

    company_id: int
    record_id: int
    period: str
    logistic_regression: PredictionResponse | None = None
    random_forest: PredictionResponse | None = None

    @property
    def agreement(self) -> bool | None:
        """True if both models predict the same risk label."""
        if self.logistic_regression is None or self.random_forest is None:
            return None
        return self.logistic_regression.risk_label == self.random_forest.risk_label

    @property
    def recommended_label(self) -> str | None:
        """The label to surface in the UI. Random Forest takes precedence on disagreement."""
        if self.random_forest is not None:
            return self.random_forest.risk_label
        if self.logistic_regression is not None:
            return self.logistic_regression.risk_label
        return None
