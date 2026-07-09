"""FinWatch Zambia — Institutional Router

Institutional portal analytics and export endpoints.

This router provides system-level views used by the institutional dashboards, including
aggregate KPIs, sector trends, benchmark summaries, and report exports.
"""

import logging
from datetime import datetime, timedelta, timezone
from statistics import median

from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_current_full_institutional,
    get_current_institutional_user,
    get_db,
)
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.schemas.institutional import (
    AnomalyFlagResponse,
    FilterOptionsResponse,
    ScalePerformanceResponse,
    ModelAgreementResponse,
    ModelPerformanceResponse,
    RatioAggregateResponse,
    RiskDistributionResponse,
    SectorInsightResponse,
    InstitutionalOverviewResponse,
    TemporalTrendResponse,
)
from app.services.institutional_report_service import (
    collect_all_report_data,
    generate_institutional_csv,
    generate_institutional_json,
    generate_institutional_pdf,
    generate_institutional_zip,
)

logger = logging.getLogger(__name__)
router = APIRouter()

HIGH_RISK_THRESHOLD = 0.70
MEDIUM_RISK_THRESHOLD = 0.40


def get_filtered_prediction_query(
    db: Session,
    entities,
    scale: str | None = None,
    sector: str | None = None
):
    query = (
        db.query(*entities)
        .select_from(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .join(User, Company.owner_id == User.id)
    )

    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        query = query.filter(User.business_scale.in_(scales_list))

    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        query = query.filter(Company.industry.in_(sectors_list))

    return query


@router.get(
    "/overview",
    response_model=InstitutionalOverviewResponse,
    summary="System-wide distress KPI summary",
)
def get_overview(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return system-level headline KPIs for the institutional dashboard."""
    total_assessments = (
        get_filtered_prediction_query(db, (func.count(Prediction.id),), scale, sector)
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0
    )

    company_query = db.query(func.count(Company.id)).select_from(Company).join(User, Company.owner_id == User.id)
    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        company_query = company_query.filter(User.business_scale.in_(scales_list))
    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        company_query = company_query.filter(Company.industry.in_(sectors_list))
    total_companies = company_query.scalar() or 0

    owner_query = db.query(func.count(func.distinct(User.id))).select_from(User).join(Company, Company.owner_id == User.id).filter(User.role == "sme_owner")
    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        owner_query = owner_query.filter(User.business_scale.in_(scales_list))
    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        owner_query = owner_query.filter(Company.industry.in_(sectors_list))
    total_sme_owners = owner_query.scalar() or 0

    prob_stats = (
        get_filtered_prediction_query(db, (func.avg(Prediction.distress_probability),), scale, sector)
        .filter(Prediction.model_used == "random_forest")
        .first()
    )
    avg_prob = float(prob_stats[0] or 0.0)

    all_probs = [
        r[0]
        for r in get_filtered_prediction_query(db, (Prediction.distress_probability,), scale, sector)
        .filter(Prediction.model_used == "random_forest")
        .all()
    ]
    high_risk = sum(1 for p in all_probs if p >= HIGH_RISK_THRESHOLD)
    medium_risk = sum(
        1 for p in all_probs if MEDIUM_RISK_THRESHOLD <= p < HIGH_RISK_THRESHOLD
    )
    low_risk = sum(1 for p in all_probs if p < MEDIUM_RISK_THRESHOLD)

    # Use 0.5 as the standard binary classification threshold for "distressed"
    distressed_count = sum(1 for p in all_probs if p >= 0.5)
    overall_distress_rate = distressed_count / len(all_probs) if all_probs else 0.0

    sectors_covered = (
        get_filtered_prediction_query(db, (func.count(func.distinct(Company.industry)),), scale, sector)
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0
    )

    small_scale_query = (
        db.query(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(Company, Company.owner_id == User.id)
        .filter(User.role == "sme_owner", User.business_scale == "small_scale")
    )
    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        small_scale_query = small_scale_query.filter(Company.industry.in_(sectors_list))
    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        small_scale_query = small_scale_query.filter(User.business_scale.in_(scales_list))
    small_scale_count = small_scale_query.scalar() or 0

    medium_scale_query = (
        db.query(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(Company, Company.owner_id == User.id)
        .filter(User.role == "sme_owner", User.business_scale == "medium_scale")
    )
    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        medium_scale_query = medium_scale_query.filter(Company.industry.in_(sectors_list))
    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        medium_scale_query = medium_scale_query.filter(User.business_scale.in_(scales_list))
    medium_scale_count = medium_scale_query.scalar() or 0

    return InstitutionalOverviewResponse(
        total_assessments=total_assessments,
        total_companies=total_companies,
        total_sme_owners=total_sme_owners,
        overall_distress_rate=overall_distress_rate,
        avg_distress_prob=avg_prob,
        high_risk_count=high_risk,
        medium_risk_count=medium_risk,
        low_risk_count=low_risk,
        sectors_covered=sectors_covered,
        small_scale_count=small_scale_count,
        medium_scale_count=medium_scale_count,
        last_updated=datetime.now(timezone.utc),
    )


@router.get(
    "/scales",
    response_model=list[ScalePerformanceResponse],
    summary="Distress by business scale",
)
def get_scale_distress(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return distress rates grouped by SME business scale (methodology lock)."""
    query = get_filtered_prediction_query(
        db,
        (
            Prediction.assessment_methodology,
            func.count(Prediction.id).label("total"),
            func.sum(
                case(
                    (Prediction.distress_probability >= HIGH_RISK_THRESHOLD, 1), else_=0
                )
            ).label("high"),
            func.sum(
                case(
                    (
                        (Prediction.distress_probability >= MEDIUM_RISK_THRESHOLD)
                        & (Prediction.distress_probability < HIGH_RISK_THRESHOLD),
                        1,
                    ),
                    else_=0,
                )
            ).label("medium"),
            func.sum(
                case(
                    (Prediction.distress_probability < MEDIUM_RISK_THRESHOLD, 1),
                    else_=0,
                )
            ).label("low"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
            # Binary distress rate still uses 0.5 standard
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
        ),
        scale,
        sector,
    )

    results = (
        query.filter(Prediction.model_used == "random_forest")
        .group_by(Prediction.assessment_methodology)
        .all()
    )

    scales = []
    for methodology, total, high, medium, low, avg_prob, distressed in results:
        # Format label for display based on methodology rather than user scale
        label = (
            "Small Scale"
            if methodology == "indicative"
            else "Medium Scale" if methodology == "full" else "Unspecified"
        )
        scales.append(
            ScalePerformanceResponse(
                scale=label,
                total_assessments=int(total),
                high_risk_count=int(high or 0),
                medium_risk_count=int(medium or 0),
                low_risk_count=int(low or 0),
                distress_rate=float(distressed / total) if total > 0 else 0.0,
                avg_distress_prob=float(avg_prob or 0.0),
            )
        )
    return scales


@router.get(
    "/filter-options",
    response_model=FilterOptionsResponse,
    summary="Get available scale and sector options for filtering",
)
def get_filter_options(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return unique scales and sectors for UI filtering, linked together."""
    results = (
        db.query(Prediction.assessment_methodology, Company.industry)
        .select_from(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Prediction.model_used == "random_forest")
        .distinct()
        .all()
    )

    scales_set = set()
    sectors_list = []
    seen_sectors = set()

    for methodology, industry in results:
        scale_label = (
            "Small Scale"
            if methodology == "indicative"
            else "Medium Scale"
            if methodology == "full"
            else "Unspecified"
        )
        scales_set.add(scale_label)

        if industry:
            sector_name = industry.strip()
            key = (sector_name, scale_label)
            if key not in seen_sectors:
                seen_sectors.add(key)
                sectors_list.append({
                    "name": sector_name,
                    "scale": scale_label
                })

    sorted_scales = sorted(list(scales_set))
    sorted_sectors = sorted(sectors_list, key=lambda s: (s["scale"], s["name"]))

    return {
        "scales": sorted_scales,
        "sectors": sorted_sectors
    }


@router.get(
    "/sectors",
    response_model=list[SectorInsightResponse],
    summary="Distress by industry sector",
)
def get_sector_distress(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return distress rates and selected averages grouped by industry sector."""
    query = (
        db.query(
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
            func.avg(Prediction.distress_probability).label("avg_prob"),
            func.avg(RatioFeature.current_ratio).label("avg_cr"),
            func.avg(RatioFeature.debt_to_assets).label("avg_da"),
        )
        .select_from(Company)
        .join(FinancialRecord, FinancialRecord.company_id == Company.id)
        .join(RatioFeature, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
        .join(User, Company.owner_id == User.id)
        .filter(Prediction.model_used == "random_forest")
    )

    if scale is not None:
        scales_list = []
        for s in scale.split(","):
            s_stripped = s.strip()
            if s_stripped == "Small Scale":
                scales_list.append("small_scale")
            elif s_stripped == "Medium Scale":
                scales_list.append("medium_scale")
            else:
                scales_list.append(s_stripped)
        query = query.filter(User.business_scale.in_(scales_list))

    if sector is not None:
        sectors_list = [s.strip() for s in sector.split(",")]
        query = query.filter(Company.industry.in_(sectors_list))

    results = query.group_by(Company.industry).all()

    sectors = []
    for industry, total, distressed, avg_prob, avg_cr, avg_da in results:
        label = industry or "Unspecified"
        if total < 3:
            label = "Other (suppressed)"
        d_count = int(distressed or 0)
        sectors.append(
            SectorInsightResponse(
                industry=label,
                total_assessments=int(total),
                distress_count=d_count,
                healthy_count=int(total) - d_count,
                distress_rate=float(d_count / total) if total > 0 else 0.0,
                avg_distress_prob=float(avg_prob or 0),
                avg_current_ratio=float(avg_cr or 0),
                avg_debt_to_assets=float(avg_da or 0),
            )
        )
    return sorted(sectors, key=lambda s: s.distress_rate, reverse=True)


@router.get(
    "/trends",
    response_model=list[TemporalTrendResponse],
    summary="Monthly distress trend",
)
def get_temporal_trends(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return a monthly distress trend over the last 12 months."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    # DB-Agnostic date formatting logic
    # Cloud (Supabase) uses PostgreSQL, local uses SQLite.
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        month_label = func.to_char(Prediction.predicted_at, "YYYY-MM").label("month")
    else:
        month_label = func.strftime("%Y-%m", Prediction.predicted_at).label("month")

    results = (
        get_filtered_prediction_query(db, (
            month_label,
            func.count(Prediction.id).label("total"),
            func.sum(case((Prediction.distress_probability >= 0.5, 1), else_=0)).label(
                "distressed"
            ),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        ), scale, sector)
        .filter(
            Prediction.predicted_at >= cutoff, Prediction.model_used == "random_forest"
        )
        .group_by("month")
        .order_by("month")
        .all()
    )
    return [
        TemporalTrendResponse(
            period=month,
            total_assessments=int(total),
            distress_count=int(distressed or 0),
            healthy_count=int(total) - int(distressed or 0),
            distress_rate=float((distressed or 0) / total) if total > 0 else 0.0,
            avg_distress_prob=float(avg_prob or 0),
        )
        for month, total, distressed, avg_prob in results
    ]


@router.get(
    "/ratios",
    response_model=list[RatioAggregateResponse],
    summary="Cross-sector ratio benchmarks",
)
def get_ratio_benchmarks(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return aggregate ratio statistics across all available assessments."""
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

        dist_avg = (
            get_filtered_prediction_query(db, (func.avg(col),), scale, sector)
            .filter(
                Prediction.risk_label == "Distressed",
                Prediction.model_used == "random_forest",
            )
            .scalar()
            or 0.0
        )

        health_avg = (
            get_filtered_prediction_query(db, (func.avg(col),), scale, sector)
            .filter(
                Prediction.risk_label == "Healthy",
                Prediction.model_used == "random_forest",
            )
            .scalar()
            or 0.0
        )

        stats = (
            get_filtered_prediction_query(db, (func.avg(col), func.min(col), func.max(col)), scale, sector)
            .filter(Prediction.model_used == "random_forest")
            .first()
        )

        all_vals_query = (
            get_filtered_prediction_query(db, (col,), scale, sector)
            .filter(Prediction.model_used == "random_forest", col.isnot(None))
            .all()
        )
        all_vals = [r[0] for r in all_vals_query]
        med = median(all_vals) if all_vals else 0.0

        output.append(
            RatioAggregateResponse(
                ratio_name=ratio,
                avg_value=float(stats[0] or 0),
                median_value=float(med),
                min_value=float(stats[1] or 0),
                max_value=float(stats[2] or 0),
                distressed_avg=float(dist_avg),
                healthy_avg=float(health_avg),
            )
        )
    return output


@router.get(
    "/risk-distribution",
    response_model=list[RiskDistributionResponse],
    summary="Count per risk tier",
)
def get_risk_distribution(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return the distribution of assessments across risk tiers."""
    total = (
        get_filtered_prediction_query(db, (func.count(Prediction.id),), scale, sector)
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0
    )
    if total == 0:
        return []

    high = (
        get_filtered_prediction_query(db, (func.count(Prediction.id),), scale, sector)
        .filter(
            Prediction.model_used == "random_forest",
            Prediction.distress_probability >= HIGH_RISK_THRESHOLD,
        )
        .scalar()
        or 0
    )
    medium = (
        get_filtered_prediction_query(db, (func.count(Prediction.id),), scale, sector)
        .filter(
            Prediction.model_used == "random_forest",
            Prediction.distress_probability >= MEDIUM_RISK_THRESHOLD,
            Prediction.distress_probability < HIGH_RISK_THRESHOLD,
        )
        .scalar()
        or 0
    )
    low = total - high - medium

    return [
        RiskDistributionResponse(
            tier="High", count=high, percentage=round(high / total * 100, 1)
        ),
        RiskDistributionResponse(
            tier="Medium", count=medium, percentage=round(medium / total * 100, 1)
        ),
        RiskDistributionResponse(
            tier="Low", count=low, percentage=round(low / total * 100, 1)
        ),
    ]


@router.get(
    "/model-performance",
    response_model=list[ModelPerformanceResponse],
    summary="RF vs LR aggregate stats",
)
def get_model_performance(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return aggregate assessment counts and averages per model."""
    results = (
        get_filtered_prediction_query(db, (Prediction.model_used, func.count(Prediction.id)), scale, sector)
        .group_by(Prediction.model_used)
        .all()
    )
    output = []
    for model, total in results:
        distress = (
            get_filtered_prediction_query(db, (func.count(Prediction.id),), scale, sector)
            .filter(
                Prediction.model_used == model, Prediction.distress_probability >= 0.5
            )
            .scalar()
            or 0
        )
        avg = (
            get_filtered_prediction_query(db, (func.avg(Prediction.distress_probability),), scale, sector)
            .filter(Prediction.model_used == model)
            .scalar()
            or 0.0
        )
        output.append(
            ModelPerformanceResponse(
                model_name=model,
                total_predictions=total,
                distress_count=distress,
                healthy_count=total - distress,
                avg_distress_prob=float(avg),
                distress_rate=distress / total if total > 0 else 0,
            )
        )
    return output


@router.get(
    "/model-agreement",
    response_model=ModelAgreementResponse,
    summary="RF vs LR categorical disagreement rate across paired assessments",
)
def get_model_agreement(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_institutional_user),
):
    """Return the categorical disagreement rate between RF and LR predictions
    for assessments where both models produced a result. Disagreement is a
    risk_label mismatch only — no probability-magnitude threshold (ADR-029).
    """
    results = (
        get_filtered_prediction_query(
            db,
            (Prediction.ratio_feature_id, Prediction.model_used, Prediction.risk_label),
            scale,
            sector,
        )
        .all()
    )

    grouped: dict[int, dict[str, str]] = {}
    for rf_id, model, risk_label in results:
        if rf_id not in grouped:
            grouped[rf_id] = {}
        grouped[rf_id][model] = risk_label

    paired_assessment_count = 0
    disagreement_count = 0
    for rf_id, models in grouped.items():
        if "random_forest" in models and "logistic_regression" in models:
            paired_assessment_count += 1
            if models["random_forest"] != models["logistic_regression"]:
                disagreement_count += 1

    if paired_assessment_count > 0:
        disagreement_rate = disagreement_count / paired_assessment_count
        agreement_rate = 1.0 - disagreement_rate
    else:
        disagreement_rate = 0.0
        agreement_rate = 0.0

    return ModelAgreementResponse(
        paired_assessment_count=paired_assessment_count,
        disagreement_count=disagreement_count,
        disagreement_rate=disagreement_rate,
        agreement_rate=agreement_rate,
    )


@router.get(
    "/anomalies",
    response_model=list[AnomalyFlagResponse],
    summary="Anonymised high-risk flags",
)
def get_anomaly_flags(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_full_institutional),
):
    """Return an anonymized set of high-risk flags for oversight workflows."""
    results = (
        get_filtered_prediction_query(db, (
            Prediction.id,
            Company.industry,
            Prediction.model_used,
            Prediction.distress_probability,
            Prediction.risk_label,
            FinancialRecord.period,
            Prediction.predicted_at,
        ), scale, sector)
        .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
        .order_by(Prediction.distress_probability.desc())
        .limit(50)
        .all()
    )
    return [
        AnomalyFlagResponse(
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


@router.get("/reports/preview")
async def get_report_preview(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
    include_ai_summary: bool = True,
):
    """Return a JSON preview of the report data including AI summary."""
    try:
        data = collect_all_report_data(
            db, role=current_user.role, scale=scale, sector=sector
        )
        if include_ai_summary:
            from app.services.nlp_service import generate_institutional_summary

            summary, _ = await generate_institutional_summary(data, current_user.role)
            data["ai_summary"] = summary
        return data
    except Exception as exc:
        logger.error("Report preview failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/export/pdf")
async def export_pdf(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
    x_user_time: str | None = Header(default=None),
    include_ai_summary: bool = True,
    mask_entities: bool = False,
):
    """Export institutional summary report as a PDF."""
    try:
        pdf, name = await generate_institutional_pdf(
            db,
            user_time=x_user_time,
            role=current_user.role,
            include_ai_summary=include_ai_summary,
            mask_entities=mask_entities,
            scale=scale,
            sector=sector,
        )
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    except Exception as exc:
        logger.error("Institutional PDF export failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/export/csv")
def export_csv(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
):
    """Export institutional summary dataset as CSV."""
    try:
        csv_bytes, name = generate_institutional_csv(
            db, role=current_user.role, scale=scale, sector=sector
        )
        return Response(
            content=csv_bytes,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    except Exception as exc:
        logger.error("Institutional CSV export failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/export/json")
def export_json(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
):
    """Export institutional summary dataset as JSON."""
    try:
        js_bytes, name = generate_institutional_json(
            db, role=current_user.role, scale=scale, sector=sector
        )
        return Response(
            content=js_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    except Exception as exc:
        logger.error("Institutional JSON export failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/export/zip")
async def export_zip(
    scale: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
    x_user_time: str | None = Header(default=None),
):
    """Export institutional report bundle (PDF, CSV, JSON) as a ZIP archive."""
    try:
        zp, name = await generate_institutional_zip(
            db, user_time=x_user_time, role=current_user.role, scale=scale, sector=sector
        )
        return Response(
            content=zp,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    except Exception as exc:
        logger.error("Institutional ZIP export failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
