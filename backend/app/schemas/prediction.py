# =============================================================================
# FinWatch Zambia — Prediction & Narrative Schemas
# =============================================================================

from datetime import datetime

from pydantic import BaseModel, field_validator

# =============================================================================
# Request schemas
# =============================================================================


class PredictionCreateRequest(BaseModel):
    """
    Request body for POST /api/predictions/.

    Specifies which financial record to predict on and which ML model to use.
    Both models can be run on the same record independently — the composite
    unique constraint (ratio_feature_id, model_used) governs idempotency.
    """

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


# =============================================================================
# Sub-schemas (embedded within PredictionResponse)
# =============================================================================


class RatioFeatureResponse(BaseModel):
    """
    The 10 computed financial ratios for a prediction.
    Returned as a nested object within PredictionResponse.

    Ratio groups:
      Liquidity     — current_ratio, quick_ratio, cash_ratio
      Leverage      — debt_to_equity, debt_to_assets, interest_coverage
      Profitability — net_profit_margin, return_on_assets, return_on_equity
      Activity      — asset_turnover
    """

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
    """
    Embedded narrative view returned within a PredictionResponse.
    For the full standalone narrative record, see NarrativeDetailResponse
    in schemas/narrative.py.
    """

    content: str
    source: str  # "groq" | "ollama" | "template"
    generated_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Primary response schemas
# =============================================================================


class PredictionResponse(BaseModel):
    """
    Full prediction response including SHAP values and NLP narrative.
    Returned by POST /api/predictions/ and GET /api/predictions/{id}.
    """

    id: int
    model_used: str
    risk_label: str  # "Distressed" | "Healthy"
    distress_probability: float  # 0.0 – 1.0
    shap_values: dict[str, float]  # ratio_name → SHAP attribution
    predicted_at: datetime
    ratios: RatioFeatureResponse | None = None
    narrative: NarrativeResponse | None = None

    model_config = {"from_attributes": True}


class PredictionSummaryResponse(BaseModel):
    """
    Lightweight prediction response for history listing.
    Excludes SHAP values and narrative to reduce payload size on list endpoints.
    """

    id: int
    model_used: str
    risk_label: str
    distress_probability: float
    predicted_at: datetime
    company_name: str

    model_config = {"from_attributes": True}


# =============================================================================
# Model comparison schema
# =============================================================================


class ModelComparisonResponse(BaseModel):
    """
    Side-by-side comparison of Logistic Regression and Random Forest
    predictions on the same financial record.

    Directly supports dissertation Objective 4 — evaluating and comparing
    model performance — and is displayed in the results UI as a comparison panel.

    Fields:
      company_id         — the SME profile being assessed
      record_id          — the financial record both models were run on
      period             — reporting period of the financial record
      logistic_regression — full prediction from the LR model (or None if not run)
      random_forest       — full prediction from the RF model (or None if not run)
      agreement           — True if both models produce the same risk_label
      recommended_label   — the label to present to the user:
                            if models agree, that label; if they disagree,
                            Random Forest's label takes precedence (it
                            consistently outperforms LR in this domain per
                            Barboza et al. 2017)
    """

    company_id: int
    record_id: int
    period: str
    logistic_regression: PredictionResponse | None = None
    random_forest: PredictionResponse | None = None

    @property
    def agreement(self) -> bool | None:
        """
        True if both models predict the same risk label.
        None if fewer than two predictions are available.
        """
        if self.logistic_regression is None or self.random_forest is None:
            return None
        return self.logistic_regression.risk_label == self.random_forest.risk_label

    @property
    def recommended_label(self) -> str | None:
        """
        The label to surface in the UI.
        Random Forest takes precedence on disagreement — justified by its
        consistently superior recall on imbalanced financial distress datasets
        (Barboza, Kimura and Altman, 2017).
        """
        if self.random_forest is not None:
            return self.random_forest.risk_label
        if self.logistic_regression is not None:
            return self.logistic_regression.risk_label
        return None
