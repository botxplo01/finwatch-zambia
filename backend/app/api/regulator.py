# =============================================================================
# FinWatch Zambia — Regulator Router
#
# All endpoints require role in ("policy_analyst", "regulator").
# Export endpoints require role == "regulator".
#
# PRIVACY GUARANTEE:
#   No endpoint returns company names, owner IDs, user emails, or any
#   field that could identify a specific SME. All data is aggregated.
#
# Endpoints:
#   GET /api/regulator/overview              — system-wide KPI summary
#   GET /api/regulator/sectors               — distress by industry sector
#   GET /api/regulator/trends                — monthly distress trend
#   GET /api/regulator/risk-distribution     — count per risk tier
#   GET /api/regulator/model-performance     — RF vs LR aggregate stats
#   GET /api/regulator/ratios                — cross-sector ratio benchmarks
#   GET /api/regulator/anomalies             — anonymised high-risk flags
#   GET /api/regulator/export/pdf            — full aggregate PDF report
#   GET /api/regulator/export/csv            — flat CSV export
#   GET /api/regulator/export/json           — structured JSON export
#   GET /api/regulator/export/zip            — ZIP bundle (PDF + CSV + JSON)
# =============================================================================

import logging
from datetime import datetime, timedelta, timezone
from statistics import median

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_full_regulator,
    get_current_regulator_user,
    get_db,
)
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.schemas.regulator import (
    AnomalyFlagItem,
    ModelPerformanceSummary,
    RatioAggregateItem,
    RiskDistributionItem,
    SectorDistressItem,
    SystemOverview,
    TemporalTrendItem,
)
from app.services.regulator_report_service import (
    generate_regulator_csv,
    generate_regulator_json,
    generate_regulator_pdf,
    generate_regulator_zip,
)

logger = logging.getLogger(__name__)
router = APIRouter()

HIGH_RISK_THRESHOLD = 0.70
MEDIUM_RISK_THRESHOLD = 0.40


# =============================================================================
# GET /api/regulator/overview
# =============================================================================


@router.get(
    "/overview",
    response_model=SystemOverview,
    summary="System-wide distress KPI summary",
)
def get_overview(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    total_assessments = db.query(func.count(Prediction.id)).scalar() or 0
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    total_sme_owners = (
        db.query(func.count(User.id)).filter(User.role == "sme_owner").scalar() or 0
    )

    prob_stats = db.query(func.avg(Prediction.distress_probability)).first()
    avg_prob = float(prob_stats[0] or 0.0)

    all_probs = [r[0] for r in db.query(Prediction.distress_probability).all()]
    high_risk = sum(1 for p in all_probs if p >= HIGH_RISK_THRESHOLD)
    medium_risk = sum(
        1 for p in all_probs if MEDIUM_RISK_THRESHOLD <= p < HIGH_RISK_THRESHOLD
    )
    low_risk = sum(1 for p in all_probs if p < MEDIUM_RISK_THRESHOLD)
    overall_distress_rate = high_risk / len(all_probs) if all_probs else 0.0

    sectors_covered = (
        db.query(func.count(func.distinct(Company.industry)))
        .filter(Company.industry.isnot(None))
        .scalar()
        or 0
    )

    return SystemOverview(
        total_assessments=total_assessments,
        total_companies=total_companies,
        total_sme_owners=total_sme_owners,
        overall_distress_rate=overall_distress_rate,
        avg_distress_prob=avg_prob,
        high_risk_count=high_risk,
        medium_risk_count=medium_risk,
        low_risk_count=low_risk,
        sectors_covered=sectors_covered,
        last_updated=datetime.now(timezone.utc),
    )


# =============================================================================
# GET /api/regulator/sectors
# =============================================================================


@router.get(
    "/sectors",
    response_model=list[SectorDistressItem],
    summary="Distress by industry sector",
)
def get_sector_distress(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    results = (
        db.query(
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
            func.avg(RatioFeature.current_ratio).label("avg_cr"),
            func.avg(RatioFeature.debt_to_assets).label("avg_da"),
        )
        .join(FinancialRecord, FinancialRecord.company_id == Company.id)
        .join(RatioFeature, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
        .group_by(Company.industry)
        .all()
    )
    sectors = []
    for industry, total, avg_prob, avg_cr, avg_da in results:
        label = industry or "Unspecified"
        if total < 3:
            label = "Other (suppressed)"
        distress_count = int((avg_prob or 0) * total)
        sectors.append(
            SectorDistressItem(
                industry=label,
                total_assessments=int(total),
                distress_count=distress_count,
                healthy_count=int(total) - distress_count,
                distress_rate=float(avg_prob or 0),
                avg_distress_prob=float(avg_prob or 0),
                avg_current_ratio=float(avg_cr or 0),
                avg_debt_to_assets=float(avg_da or 0),
            )
        )
    return sorted(sectors, key=lambda s: s.distress_rate, reverse=True)


# =============================================================================
# GET /api/regulator/trends
# =============================================================================


@router.get(
    "/trends",
    response_model=list[TemporalTrendItem],
    summary="Monthly distress trend (12 months)",
)
def get_temporal_trends(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    results = (
        db.query(
            func.strftime("%Y-%m", Prediction.predicted_at).label("month"),
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .filter(Prediction.predicted_at >= cutoff)
        .group_by("month")
        .order_by("month")
        .all()
    )
    return [
        TemporalTrendItem(
            period=month,
            total_assessments=int(total),
            distress_count=int(float(avg_prob or 0) * total),
            healthy_count=int(total) - int(float(avg_prob or 0) * total),
            distress_rate=float(avg_prob or 0),
            avg_distress_prob=float(avg_prob or 0),
        )
        for month, total, avg_prob in results
    ]


# =============================================================================
# GET /api/regulator/risk-distribution
# =============================================================================


@router.get(
    "/risk-distribution",
    response_model=list[RiskDistributionItem],
    summary="Count per risk tier",
)
def get_risk_distribution(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    all_probs = [r[0] for r in db.query(Prediction.distress_probability).all()]
    total = len(all_probs)
    if total == 0:
        return []
    high = sum(1 for p in all_probs if p >= HIGH_RISK_THRESHOLD)
    medium = sum(
        1 for p in all_probs if MEDIUM_RISK_THRESHOLD <= p < HIGH_RISK_THRESHOLD
    )
    low = total - high - medium
    return [
        RiskDistributionItem(
            tier="High", count=high, percentage=round(high / total * 100, 1)
        ),
        RiskDistributionItem(
            tier="Medium", count=medium, percentage=round(medium / total * 100, 1)
        ),
        RiskDistributionItem(
            tier="Low", count=low, percentage=round(low / total * 100, 1)
        ),
    ]


# =============================================================================
# GET /api/regulator/model-performance
# =============================================================================


@router.get(
    "/model-performance",
    response_model=list[ModelPerformanceSummary],
    summary="RF vs LR aggregate stats",
)
def get_model_performance(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    results = (
        db.query(
            Prediction.model_used,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .group_by(Prediction.model_used)
        .all()
    )
    output = []
    for model_used, total, avg_prob in results:
        distress = int(float(avg_prob or 0) * total)
        output.append(
            ModelPerformanceSummary(
                model_name=model_used,
                total_predictions=int(total),
                distress_count=distress,
                healthy_count=int(total) - distress,
                avg_distress_prob=float(avg_prob or 0),
                distress_rate=float(avg_prob or 0),
            )
        )
    return output


# =============================================================================
# GET /api/regulator/ratios
# =============================================================================


@router.get(
    "/ratios",
    response_model=list[RatioAggregateItem],
    summary="Cross-sector ratio benchmarks",
)
def get_ratio_benchmarks(
    db: Session = Depends(get_db), _: User = Depends(get_current_regulator_user)
):
    RATIOS = [
        "current_ratio",
        "quick_ratio",
        "cash_ratio",
        "debt_to_equity",
        "debt_to_assets",
        "interest_coverage",
        "net_profit_margin",
        "return_on_assets",
        "return_on_equity",
        "asset_turnover",
    ]
    output = []
    for ratio in RATIOS:
        col = getattr(RatioFeature, ratio)
        stats = (
            db.query(func.avg(col), func.min(col), func.max(col))
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .first()
        )
        all_vals = [
            r[0]
            for r in db.query(col)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(col.isnot(None))
            .all()
        ]
        med = median(all_vals) if all_vals else 0.0
        distressed_avg = (
            db.query(func.avg(col))
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        healthy_avg = (
            db.query(func.avg(col))
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability < MEDIUM_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        output.append(
            RatioAggregateItem(
                ratio_name=ratio,
                avg_value=float(stats[0] or 0),
                median_value=float(med),
                min_value=float(stats[1] or 0),
                max_value=float(stats[2] or 0),
                distressed_avg=float(distressed_avg),
                healthy_avg=float(healthy_avg),
            )
        )
    return output


# =============================================================================
# GET /api/regulator/anomalies
# =============================================================================


@router.get(
    "/anomalies",
    response_model=list[AnomalyFlagItem],
    summary="Anonymised high-risk flags",
)
def get_anomaly_flags(
    db: Session = Depends(get_db), _: User = Depends(get_current_full_regulator)
):
    results = (
        db.query(
            Prediction.id,
            Company.industry,
            Prediction.model_used,
            Prediction.distress_probability,
            Prediction.risk_label,
            FinancialRecord.period,
            Prediction.predicted_at,
        )
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
        .order_by(Prediction.distress_probability.desc())
        .limit(50)
        .all()
    )
    return [
        AnomalyFlagItem(
            assessment_id=pred_id,
            industry=industry or "Unspecified",
            model_used=model_used,
            distress_probability=distress_probability,
            risk_label=risk_label,
            period=period,
            flagged_at=flagged_at,
        )
        for pred_id, industry, model_used, distress_probability, risk_label, period, flagged_at in results
    ]


# =============================================================================
# EXPORT ENDPOINTS — regulator role only
# =============================================================================


@router.get(
    "/export/pdf",
    summary="Download full aggregate regulatory PDF report (regulator only)",
)
def export_pdf(
    db: Session = Depends(get_db), _: User = Depends(get_current_full_regulator)
):
    try:
        pdf_bytes, filename = generate_regulator_pdf(db)
    except Exception as exc:
        logger.error("Regulator PDF export failed: %s", exc)
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/csv",
    summary="Download flat CSV export of all aggregate data (regulator only)",
)
def export_csv(
    db: Session = Depends(get_db), _: User = Depends(get_current_full_regulator)
):
    try:
        csv_bytes, filename = generate_regulator_csv(db)
    except Exception as exc:
        logger.error("Regulator CSV export failed: %s", exc)
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"CSV generation failed: {exc}")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/json",
    summary="Download structured JSON export matching full prediction schema (regulator only)",
)
def export_json(
    db: Session = Depends(get_db), _: User = Depends(get_current_full_regulator)
):
    try:
        json_bytes, filename = generate_regulator_json(db)
    except Exception as exc:
        logger.error("Regulator JSON export failed: %s", exc)
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"JSON generation failed: {exc}")
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/zip", summary="Download ZIP bundle (PDF + CSV + JSON) (regulator only)"
)
def export_zip(
    db: Session = Depends(get_db), _: User = Depends(get_current_full_regulator)
):
    try:
        zip_bytes, filename = generate_regulator_zip(db)
    except Exception as exc:
        logger.error("Regulator ZIP export failed: %s", exc)
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"ZIP generation failed: {exc}")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
