# =============================================================================
# FinWatch Zambia — Regulator Schemas
# All data returned by the regulator router is anonymised — no company names,
# user IDs, or personally identifiable information is exposed.
# =============================================================================

from datetime import datetime
from pydantic import BaseModel


class SectorDistressItem(BaseModel):
    """Distress statistics for a single industry sector."""
    industry:              str
    total_assessments:     int
    distress_count:        int
    healthy_count:         int
    distress_rate:         float   # 0.0 – 1.0
    avg_distress_prob:     float
    avg_current_ratio:     float
    avg_debt_to_assets:    float


class TemporalTrendItem(BaseModel):
    """Monthly aggregate distress trend."""
    period:            str     # "YYYY-MM"
    total_assessments: int
    distress_count:    int
    healthy_count:     int
    distress_rate:     float
    avg_distress_prob: float


class RiskDistributionItem(BaseModel):
    """Count of predictions per risk tier."""
    tier:       str     # "High" | "Medium" | "Low"
    count:      int
    percentage: float


class ModelPerformanceSummary(BaseModel):
    """Aggregate model usage statistics (no individual prediction data)."""
    model_name:        str
    total_predictions: int
    distress_count:    int
    healthy_count:     int
    avg_distress_prob: float
    distress_rate:     float


class SystemOverview(BaseModel):
    """High-level system statistics for the regulator overview panel."""
    total_assessments:      int
    total_companies:        int
    total_sme_owners:       int
    overall_distress_rate:  float
    avg_distress_prob:      float
    high_risk_count:        int
    medium_risk_count:      int
    low_risk_count:         int
    sectors_covered:        int
    last_updated:           datetime


class RatioAggregateItem(BaseModel):
    """Cross-sector average ratio values for benchmarking."""
    ratio_name:    str
    avg_value:     float
    median_value:  float
    min_value:     float
    max_value:     float
    distressed_avg: float
    healthy_avg:    float


class AnomalyFlagItem(BaseModel):
    """
    An anonymised company flagged as high risk.
    No company name or owner ID is exposed — only sector and risk metrics.
    """
    assessment_id:        int
    industry:             str
    model_used:           str
    distress_probability: float
    risk_label:           str
    period:               str
    flagged_at:           datetime
