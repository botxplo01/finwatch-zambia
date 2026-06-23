"""FinWatch Zambia - Institutional Chat Router

Institutional portal chat endpoints.

This router provides the regulator/policy analyst chat feature.

Key behaviors:
- Uses anonymized, aggregate context (no company names or user identifiers).
- Adapts context based on role (e.g., anomaly flags for full regulators).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_institutional_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.services.ai_usage_service import get_ai_usage_status, log_ai_message
from app.services.nlp_service import ASSISTANT_GUARDRAILS, generate_chat_response
from app.services import conversation_service

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


class InstitutionalChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    conversation_id: Optional[int] = None


class InstitutionalChatResponse(BaseModel):
    reply: str
    source: str
    current_count: int
    cooldown_until: Optional[str] = None
    conversation_id: Optional[int] = None
    conversation_at_capacity: bool = False


class UsageStatusResponse(BaseModel):
    is_blocked: bool
    current_count: int
    cooldown_until: Optional[str] = None


@router.get("/status", response_model=UsageStatusResponse)
def get_usage_status_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
):
    """Return the current AI chat usage status for the authenticated institutional user."""
    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, current_user.id, ai_type="portal"
    )
    return UsageStatusResponse(
        is_blocked=is_blocked,
        current_count=count,
        cooldown_until=cooldown_until.isoformat() if cooldown_until else None,
    )


@router.post(
    "/",
    response_model=InstitutionalChatResponse,
    summary="Institutional AI assistant — answer questions about system-wide distress analytics",
)
async def institutional_chat(
    request: InstitutionalChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_institutional_user),
):
    """Process a chat message from a regulator or policy analyst."""
    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, current_user.id, ai_type="portal"
    )
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "AI usage limit reached.",
                "cooldown_until": (
                    cooldown_until.isoformat() if cooldown_until else None
                ),
            },
        )

    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    try:
        context = _build_institutional_context(current_user, db)
        system_prompt = _build_institutional_system_prompt(context, current_user.role)
        history = [{"role": m.role, "content": m.content} for m in request.history]

        reply, source = await generate_chat_response(
            system_prompt=system_prompt,
            history=history,
            message=request.message,
        )
    except Exception as exc:
        logger.error("Institutional chat failed for user %d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat service is temporarily unavailable. Please try again.",
        )

    # ── Conversation persistence ──────────────────────────────────────────
    active_conversation_id: int | None = None
    conversation_at_capacity = False

    try:
        if request.conversation_id:
            # Check capacity before appending
            at_cap = conversation_service.is_conversation_at_capacity(
                db, request.conversation_id, current_user.id
            )
            if at_cap:
                conversation_at_capacity = True
                active_conversation_id = request.conversation_id
            else:
                updated = conversation_service.append_messages(
                    db,
                    conversation_id=request.conversation_id,
                    user_id=current_user.id,
                    user_message=request.message,
                    ai_response=reply,
                    ai_source=source,
                )
                active_conversation_id = (
                    updated.id if updated else request.conversation_id
                )
        else:
            # First message — create new conversation
            conv = conversation_service.create_conversation(
                db,
                user_id=current_user.id,
                portal_type="institutional",
                first_user_message=request.message,
                first_ai_response=reply,
                ai_source=source,
            )
            active_conversation_id = conv.id
    except Exception as exc:
        logger.error("Conversation persistence failed: %s", exc)
        active_conversation_id = None

    # SUCCESS - Log message after response is obtained
    just_blocked, cooldown_until_new = log_ai_message(
        db, current_user.id, ai_type="portal"
    )
    _, final_count, _ = get_ai_usage_status(db, current_user.id, ai_type="portal")

    logger.info(
        "Institutional chat: user_id=%d role=%s source=%s chars=%d",
        current_user.id,
        current_user.role,
        source,
        len(reply),
    )
    return InstitutionalChatResponse(
        reply=reply,
        source=source,
        current_count=final_count,
        cooldown_until=(
            cooldown_until_new.replace(tzinfo=timezone.utc).isoformat()
            if cooldown_until_new
            else None
        ),
        conversation_id=active_conversation_id,
        conversation_at_capacity=conversation_at_capacity,
    )


def _build_institutional_context(user: User, db: Session) -> str:
    """Build anonymized aggregate context for institutional AI assistant."""
    lines = []

    # Institutional aggregation uses Random Forest only, consistent with existing institutional
    # analytics precedent (Session 23) — RF and LR probabilities are not directly comparable
    # and must not be pooled.
    total_assessments = (
        db.query(func.count(Prediction.id))
        .filter(Prediction.model_used == "random_forest")
        .scalar()
        or 0
    )
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

    all_probs = [
        r[0]
        for r in db.query(Prediction.distress_probability)
        .filter(Prediction.model_used == "random_forest")
        .all()
    ]
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
        .filter(Prediction.model_used == "random_forest")
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
        .filter(
            Prediction.predicted_at >= cutoff,
            Prediction.model_used == "random_forest",
        )
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
            .filter(
                Prediction.model_used == "random_forest",
                Prediction.distress_probability >= HIGH_RISK_THRESHOLD,
            )
            .scalar()
            or 0.0
        )
        healthy_avg = (
            db.query(func.avg(col))
            .select_from(RatioFeature)
            .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
            .filter(
                Prediction.model_used == "random_forest",
                Prediction.distress_probability < MEDIUM_RISK_THRESHOLD,
            )
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
            .filter(
                Prediction.model_used == "random_forest",
                Prediction.distress_probability >= HIGH_RISK_THRESHOLD,
            )
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


ANALYST_USAGE_GUIDANCE = """
=== POLICY ANALYST USAGE GUIDANCE ===
1. Monitor sector-wide performance via the Dashboard and Sector Insights.
2. Track longitudinal stability via Temporal Trends.
3. Generate strategic institutional reports for policy review.
4. Use the AI Assistant to synthesise macro-level findings.
"""

REGULATOR_USAGE_GUIDANCE = """
=== REGULATOR USAGE GUIDANCE ===
1. Monitor system-wide KPIs and identify high-risk distress clusters.
2. Investigate specific anonymised anomaly flags for supervisory oversight.
3. Track temporal trends to ensure system-wide stability.
4. Generate and export full regulatory datasets and reports.
"""


def _build_institutional_system_prompt(context: str, user_role: str) -> str:
    is_analyst = user_role == "policy_analyst"
    role_label = "Policy Analyst" if is_analyst else "Regulator"
    usage_guidance = ANALYST_USAGE_GUIDANCE if is_analyst else REGULATOR_USAGE_GUIDANCE

    role_specific_goal = (
        "Your goal is to provide strategic synthesis of sector-wide trends. Help the Analyst evaluate economic policy impacts and identify macro-level financial stability patterns."
        if is_analyst
        else "Your goal is to support investigative oversight and compliance. Help the Regulator identify high-risk anomalies and interpret system-wide distress flags for proactive intervention."
    )
    anomaly_note = (
        "Anonymised anomaly flags are restricted to full Regulator role users; you must focus on aggregate sector-level synthesis."
        if is_analyst
        else "You have access to anonymised high-risk anomaly flags in the data context below."
    )

    return f"""You are FinWatch AI, a senior institutional advisor embedded in the FinWatch Zambia {
        role_label
    } Portal.

ROLE CONTEXT:
You are assisting a {role_label}. {role_specific_goal}

{ASSISTANT_GUARDRAILS}

{usage_guidance}

BEHAVIOUR RULES:
1. ADVISOR FIRST: Prioritise answering the user's question with institutional-grade professional insights.
2. ROLE-TAILORED ANALYSIS: {
        "Focus on sectoral trends, average distress probabilities, and model performance across the system. Help formulate data-driven policy recommendations."
        if is_analyst
        else "Focus on high-risk identifiers, distress rates, and model reliability for supervisory oversight. Help prioritize investigative actions."
    }
3. DATA-DRIVEN: Derive all insights from the aggregate system statistics provided below.
4. STRUCTURED FORMATTING: Use Markdown headings, **bold** terms, and clear sections.
5. CLEAN STRUCTURE: Use tables for comparing sectoral metrics or model statistics. Use varied list types:
    - Numbered lists (1, 2, 3) for ranked priorities or steps.
    - Lettered lists (a, b, c) for nested details.
    - Bullets (• or -) for general points.
    Always use a NEW LINE for every list item.
6. AUTHORSHIP: If asked, confirm you were developed by David Lameck and Denise Seti for academic research (2026).
7. DATA GOVERNANCE: {anomaly_note}
8. NO HALLUCINATIONS: Never claim Zambian data was used for model training.
9. RESPONSE LENGTH: Calibrate verbosity to the user's intent and phrasing, not the topic
   category. Concise (1-3 sentences, under 100 words) for generic factual or definitional
   questions, including ones that merely reference a platform term (SHAP, a specific ratio,
   Random Forest) to ask what it IS in general. Full depth only for questions analyzing the
   specific aggregate system data provided below, or where the user explicitly requests detail
   ("explain in detail", "walk me through", "give me a breakdown"). Merely mentioning a
   platform or financial term is not itself a trigger for full depth.

=== CURRENT SYSTEM DATA (anonymised) ===
{context}
=== END OF SYSTEM DATA ===

If the system data shows no assessments yet, professionally inform the user that the dashboard will populate once SMEs submit assessments, allowing for more specific analysis."""
