"""
FinWatch Zambia - Institutional Schemas

All data returned by the institutional router is anonymised.
"""

from datetime import datetime

from pydantic import BaseModel


class SectorInsightResponse(BaseModel):
    """Distress statistics for a single industry sector."""

    industry: str
    total_assessments: int
    distress_count: int
    healthy_count: int
    distress_rate: float  # 0.0 – 1.0
    avg_distress_prob: float
    avg_current_ratio: float
    avg_debt_to_assets: float


class TemporalTrendResponse(BaseModel):
    """Monthly aggregate distress trend."""

    period: str  # "YYYY-MM"
    total_assessments: int
    distress_count: int
    healthy_count: int
    distress_rate: float
    avg_distress_prob: float


class RiskDistributionResponse(BaseModel):
    """Count of predictions per risk tier."""

    tier: str
    count: int
    percentage: float


class ModelPerformanceResponse(BaseModel):
    """Aggregate model usage statistics."""

    model_name: str
    total_predictions: int
    distress_count: int
    healthy_count: int
    avg_distress_prob: float
    distress_rate: float

    model_config = {"protected_namespaces": ()}


class ScalePerformanceResponse(BaseModel):
    """Count of predictions per business scale including risk tiers."""

    scale: str
    total_assessments: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    distress_rate: float
    avg_distress_prob: float


class InstitutionalOverviewResponse(BaseModel):
    """High-level system statistics for the institutional overview panel."""

    total_assessments: int
    total_companies: int
    total_sme_owners: int
    overall_distress_rate: float
    avg_distress_prob: float
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    sectors_covered: int
    small_scale_count: int
    medium_scale_count: int
    last_updated: datetime


class RatioAggregateResponse(BaseModel):
    """Cross-sector average ratio values for benchmarking."""

    ratio_name: str
    avg_value: float
    median_value: float
    min_value: float
    max_value: float
    distressed_avg: float
    healthy_avg: float


class AnomalyFlagResponse(BaseModel):
    """An anonymised company flagged as high risk."""

    assessment_id: int
    industry: str
    model_used: str
    distress_probability: float
    risk_label: str
    period: str
    flagged_at: datetime

    model_config = {"protected_namespaces": ()}


class SectorFilterOption(BaseModel):
    """Sector details for filtering options."""

    name: str
    scale: str


class FilterOptionsResponse(BaseModel):
    """Available scales and sectors for filtering."""

    scales: list[str]
    sectors: list[SectorFilterOption]


class ModelAgreementResponse(BaseModel):
    """Categorical agreement/disagreement rate between RF and LR on paired assessments.

    An assessment is "paired" only when both Random Forest and Logistic
    Regression predictions exist for the same ratio_feature_id. Disagreement
    is a categorical risk_label mismatch only — no probability-magnitude
    threshold (ADR-029).
    """

    paired_assessment_count: int
    disagreement_count: int
    disagreement_rate: float  # 0.0 – 1.0
    agreement_rate: float  # 0.0 – 1.0, convenience = 1 - disagreement_rate

    model_config = {"protected_namespaces": ()}

