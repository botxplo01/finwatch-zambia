"""
FinWatch Zambia - Regulator Chat Router

Endpoint: POST /api/regulator/chat — AI assistant for regulatory analysis queries.

Key differences from SME chat:
- Context is AGGREGATE and anonymised — no company names or user IDs
- System prompt is policy-oriented
- Full regulators receive anomaly flag context; policy analysts do not
- Accessible to both "regulator" and "policy_analyst" roles
"""

import logging
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_regulator_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.services.ai_usage_service import get_ai_usage_status, log_ai_message
from app.services.nlp_service import ASSISTANT_GUARDRAILS, generate_chat_response

logger = logging.getLogger(__name__)
router = APIRouter()

HIGH_RISK_THRESHOLD = 0.70
MEDIUM_RISK_THRESHOLD = 0.40

RATIO_LABELS = {
    "current_ratio": "Current Ratio",
    "quick_ratio": "Quick Ratio",
    "cash_ratio": "Cash Ratio",
    "debt_to_equity": "Debt to Equity",
    "debt_to_assets": "Debt to Assets",
    "interest_coverage": "Interest Coverage",
    "net_profit_margin": "Net Profit Margin",
    "return_on_assets": "Return on Assets",
    "return_on_equity": "Return on Equity",
    "asset_turnover": "Asset Turnover",
}


class ChatMessage(BaseModel):
    role: str
    content: str


class RegulatorChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class RegulatorChatResponse(BaseModel):
    reply: str
    source: str
    cooldown_until: Optional[str] = None


class UsageStatusResponse(BaseModel):
    is_blocked: bool
    current_count: int
    cooldown_until: Optional[str] = None


@router.get("/status", response_model=UsageStatusResponse)
def get_usage_status_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_regulator_user),
):
    """Check current AI usage status for the authenticated regulator user."""
    is_blocked, count, cooldown_until = get_ai_usage_status(db, current_user.id)
    return UsageStatusResponse(
        is_blocked=is_blocked,
        current_count=count,
        cooldown_until=cooldown_until.isoformat() if cooldown_until else None,
    )


@router.post(
    "/",
    response_model=RegulatorChatResponse,
    summary="Regulator AI assistant — answer questions about system-wide distress analytics",
)
def regulator_chat(
    request: RegulatorChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_regulator_user),
):
    """Process a chat message from a regulator or policy analyst."""
    # 1. Check if already blocked
    is_blocked, count, cooldown_until = get_ai_usage_status(db, current_user.id)
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "AI usage limit reached.",
                "cooldown_until": cooldown_until.isoformat()
                if cooldown_until
                else None,
            },
        )

    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    # 2. Log message and check if limit tripped
    just_blocked, cooldown_until_new = log_ai_message(db, current_user.id)

    try:
        context = _build_regulator_context(current_user, db)
        system_prompt = _build_regulator_system_prompt(context, current_user.role)
        history = [{"role": m.role, "content": m.content} for m in request.history]

        reply, source = generate_chat_response(
            system_prompt=system_prompt,
            history=history,
            message=request.message,
        )
    except Exception as exc:
        logger.error("Regulator chat failed for user %d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat service is temporarily unavailable. Please try again.",
        )

    logger.info(
        "Regulator chat: user_id=%d role=%s source=%s chars=%d",
        current_user.id,
        current_user.role,
        source,
        len(reply),
    )
    return RegulatorChatResponse(
        reply=reply,
        source=source,
        cooldown_until=cooldown_until_new.isoformat() if cooldown_until_new else None,
    )


def _build_regulator_context(user: User, db: Session) -> str:
    """Build anonymised aggregate context for the regulator AI assistant."""
    lines = []

    total_assessments = db.query(func.count(Prediction.id)).scalar() or 0
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    total_owners = (
        db.query(func.count(User.id)).filter(User.role == "sme_owner").scalar() or 0
    )
    sectors_covered = (
        db.query(func.count(func.distinct(Company.industry)))
        .filter(Company.industry.isnot(None))
        .scalar()
        or 0
    )

    all_probs = [r[0] for r in db.query(Prediction.distress_probability).all()]
    high_risk = sum(1 for p in all_probs if p >= HIGH_RISK_THRESHOLD)
    medium_risk = sum(
        1 for p in all_probs if MEDIUM_RISK_THRESHOLD <= p < HIGH_RISK_THRESHOLD
    )
    low_risk = len(all_probs) - high_risk - medium_risk
    avg_prob = sum(all_probs) / len(all_probs) if all_probs else 0.0
    distress_rate = high_risk / len(all_probs) if all_probs else 0.0

    lines.append("=== SYSTEM-WIDE OVERVIEW ===")
    lines.append(f"Total Assessments: {total_assessments}")
    lines.append(f"Total Registered SMEs: {total_companies}")
    lines.append(f"Total SME Owners: {total_owners}")
    lines.append(f"Sectors Covered: {sectors_covered}")
    lines.append(
        f"High Risk (≥70%): {high_risk} ({distress_rate * 100:.1f}% of all assessments)"
    )
    lines.append(f"Medium Risk (40–70%): {medium_risk}")
    lines.append(f"Low Risk / Healthy (<40%): {low_risk}")
    lines.append(f"System Average Distress Probability: {avg_prob * 100:.2f}%")
    lines.append("")

    sector_rows = (
        db.query(
            Company.industry,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .select_from(Company)
        .join(FinancialRecord, FinancialRecord.company_id == Company.id)
        .join(RatioFeature, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
        .group_by(Company.industry)
        .order_by(func.avg(Prediction.distress_probability).desc())
        .all()
    )

    if sector_rows:
        lines.append("=== SECTOR DISTRESS BREAKDOWN (sorted by distress rate) ===")
        for industry, total, avg_p in sector_rows:
            label = industry or "Unspecified"
            if total < 3:
                label = "Other (suppressed for privacy)"
            lines.append(
                f"  {label}: {int(total)} assessments, "
                f"avg distress prob {float(avg_p or 0) * 100:.1f}%"
            )
        lines.append("")

    cutoff = datetime.now(timezone.utc) - timedelta(days=180)

    # DB-Agnostic month formatting
    dialect = db.bind.dialect.name
    if dialect == "postgresql":
        month_label = func.to_char(Prediction.predicted_at, "YYYY-MM").label("month")
    else:
        month_label = func.strftime("%Y-%m", Prediction.predicted_at).label("month")

    trend_rows = (
        db.query(
            month_label,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .filter(Prediction.predicted_at >= cutoff)
        .group_by("month")
        .order_by("month")
        .all()
    )

    if trend_rows:
        lines.append("=== MONTHLY TRENDS (last 6 months) ===")
        for month, total, avg_p in trend_rows:
            lines.append(
                f"  {month}: {int(total)} assessments, "
                f"avg distress {float(avg_p or 0) * 100:.1f}%"
            )
        lines.append("")

    model_rows = (
        db.query(
            Prediction.model_used,
            func.count(Prediction.id).label("total"),
            func.avg(Prediction.distress_probability).label("avg_prob"),
        )
        .group_by(Prediction.model_used)
        .all()
    )

    if model_rows:
        lines.append("=== ML MODEL PERFORMANCE ===")
        for model_used, total, avg_p in model_rows:
            label = (
                "Random Forest"
                if model_used == "random_forest"
                else "Logistic Regression"
            )
            dist = int(float(avg_p or 0) * total)
            lines.append(
                f"  {label}: {int(total)} predictions, "
                f"{dist} distress flags, avg prob {float(avg_p or 0) * 100:.1f}%"
            )
        lines.append("")

    lines.append("=== FINANCIAL RATIO SYSTEM AVERAGES (distressed vs healthy) ===")
    for ratio_name, ratio_label in RATIO_LABELS.items():
        col = getattr(RatioFeature, ratio_name)
        dist_avg = (
            db.query(func.avg(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        healthy_avg = (
            db.query(func.avg(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(Prediction.distress_probability < MEDIUM_RISK_THRESHOLD)
            .scalar()
            or 0.0
        )
        lines.append(
            f"  {ratio_label}: distressed avg = {float(dist_avg):.3f}, "
            f"healthy avg = {float(healthy_avg):.3f}"
        )
    lines.append("")

    if user.role == "regulator":
        anomaly_rows = (
            db.query(
                Prediction.id,
                Company.industry,
                Prediction.model_used,
                Prediction.distress_probability,
                FinancialRecord.period,
                Prediction.predicted_at,
            )
            .select_from(Prediction)
            .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
            .join(
                FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id
            )
            .join(Company, FinancialRecord.company_id == Company.id)
            .filter(Prediction.distress_probability >= HIGH_RISK_THRESHOLD)
            .order_by(Prediction.distress_probability.desc())
            .limit(20)
            .all()
        )
        if anomaly_rows:
            lines.append("=== ANONYMISED HIGH-RISK FLAGS (distress ≥ 70%) ===")
            for pred_id, industry, model_used, prob, period, flagged_at in anomaly_rows:
                model_label = "RF" if model_used == "random_forest" else "LR"
                date_str = flagged_at.strftime("%d %b %Y") if flagged_at else "N/A"
                lines.append(
                    f"  Ref #{pred_id}: sector={industry or 'Unspecified'}, "
                    f"period={period}, model={model_label}, "
                    f"distress={prob * 100:.1f}%, flagged={date_str}"
                )
            lines.append("")

    return "\n".join(lines)


REGULATOR_USAGE_GUIDANCE = """
=== REGULATOR USAGE GUIDANCE ===
1. Navigate through dashboard/analytics pages.
2. Review financial distress stats and system insights.
3. Filter and interpret prediction trends/summaries.
4. Generate and export reports.
For a detailed walkthrough, open the guided tutorial via the info icon in the top-right.
"""


def _build_regulator_system_prompt(context: str, user_role: str) -> str:
    role_label = "Regulator" if user_role == "regulator" else "Policy Analyst"
    anomaly_note = (
        "You have access to anonymised high-risk anomaly flags in the data above."
        if user_role == "regulator"
        else "Anonymised anomaly flags are restricted to full Regulator role users."
    )

    return f"""You are FinWatch AI, an expert regulatory financial intelligence assistant embedded \
in the FinWatch Zambia Regulator Portal — an ML-based financial distress surveillance system for Zambian SMEs.

You are currently assisting a user with the role: {role_label}.

{ASSISTANT_GUARDRAILS}

{REGULATOR_USAGE_GUIDANCE}

BEHAVIOUR RULES:
1. DETAILED STATISTICS: Provide detailed explanations when interpreting system-wide statistics, sector trends, and aggregate ratios.
2. CONCISE MODELS: Keep explanations of ML model performance and technical mechanics concise unless a deeper breakdown is explicitly requested.
3. GROUNDING: Ground all answers in the aggregate system data provided below.
4. ANONYMITY: Never identify or speculate about individual companies. All data is anonymised.
5. CONCISENESS: Keep policy-oriented responses focused (120-250 words).
6. FORMATTING: Always use a NEW LINE for every item in an ordered or unordered list. Never list multiple items on the same line. Items in an unordered list should use a bullet point (•) or dash (-) as the prefix.
7. NO HALLUCINATIONS: Never claim Zambian data was used for training.
8. SCOPE: Stay strictly within financial distress analysis and regulatory oversight.
9. GUIDANCE: Always end usage questions by directing users to the guided tutorial (info icon).
10. {anomaly_note}

=== CURRENT SYSTEM DATA (anonymised) ===
{context}
=== END OF SYSTEM DATA ===

If the system data shows no assessments yet, inform the user that the dashboard will populate once SMEs submit assessments."""
