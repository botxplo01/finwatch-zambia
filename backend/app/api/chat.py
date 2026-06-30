"""
SME portal chat endpoints.

This router powers the SME portal chat feature.

Key behaviors:
- Uses the authenticated user's recent predictions as context.
- Accepts conversation history from the frontend.
- Enforces message rate limits over a rolling time window.
"""

import json
import logging
from datetime import timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_sme_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.services.ai_usage_service import get_ai_usage_status, log_ai_message
from app.services.nlp_service import build_chat_system_prompt, generate_chat_response
from app.services import conversation_service
from app.services.ratio_engine import RATIO_BENCHMARKS_DISPLAY, RATIO_DISPLAY_NAMES

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    conversation_id: Optional[int] = None


class ChatResponse(BaseModel):
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
    current_user: User = Depends(get_current_sme_user),
):
    """Return the current AI chat usage status for the authenticated user."""
    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, current_user.id, ai_type="portal"
    )
    return UsageStatusResponse(
        is_blocked=is_blocked,
        current_count=count,
        cooldown_until=(
            cooldown_until.replace(tzinfo=timezone.utc).isoformat()
            if cooldown_until
            else None
        ),
    )


def _build_predictions_context(user: User, db: Session) -> str:
    """Fetch the user's 20 most recent distinct assessments and format them as a structured
    plain-text block.

    Assessments are grouped by ratio_feature_id so that both models for a single financial
    period appear in one block rather than as duplicate entries.

    Context cap: only the 20 most recent assessments (by ratio_feature_id descending) are
    included. Any assessment older than that window is not visible to the assistant. If a
    user references a company or period that falls outside this window, the correct behaviour
    is to state that it is not available in recent history rather than fabricate an answer.
    """
    # Step 1: Find the 20 most recent distinct ratio_feature_ids owned by this user.
    recent_rfids_subq = (
        select(RatioFeature.id)
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .where(Company.owner_id == user.id)
        .order_by(RatioFeature.id.desc())
        .limit(20)
    )

    # Step 2: Fetch all Prediction rows for those ratio_feature_ids (both models).
    rows = (
        db.query(
            Prediction,
            Company.name.label("company_name"),
            FinancialRecord.period.label("period"),
        )
        .select_from(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Prediction.ratio_feature_id.in_(recent_rfids_subq))
        .order_by(Prediction.ratio_feature_id.desc(), Prediction.model_used)
        .all()
    )

    if not rows:
        return ""

    # Step 3: Group by ratio_feature_id, preserving insertion order.
    grouped: dict[int, dict] = {}
    for pred, company_name, period in rows:
        rfid = pred.ratio_feature_id
        if rfid not in grouped:
            grouped[rfid] = {
                "company_name": company_name,
                "period": period,
                "ratio_feature": pred.ratio_feature,
                "rf": None,
                "lr": None,
            }
        if pred.model_used == "random_forest":
            grouped[rfid]["rf"] = pred
        else:
            grouped[rfid]["lr"] = pred

    lines: list[str] = []
    for i, (rfid, data) in enumerate(grouped.items(), 1):
        rf: Prediction | None = data["rf"]
        lr: Prediction | None = data["lr"]
        ratio_feature = data["ratio_feature"]

        lines.append(f"--- Assessment {i} ---")
        lines.append(f"Company: {data['company_name']}")
        lines.append(f"Period: {data['period']}")

        if ratio_feature:
            lines.append("Financial Ratios:")
            lines.append(f"  Current Ratio: {ratio_feature.current_ratio:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['current_ratio']})")
            lines.append(f"  Quick Ratio: {ratio_feature.quick_ratio:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['quick_ratio']})")
            lines.append(f"  Cash Ratio: {ratio_feature.cash_ratio:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['cash_ratio']})")
            lines.append(f"  Debt-to-Equity: {ratio_feature.debt_to_equity:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['debt_to_equity']})")
            lines.append(f"  Debt-to-Assets: {ratio_feature.debt_to_assets:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['debt_to_assets']})")
            lines.append(f"  Interest Coverage: {ratio_feature.interest_coverage:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['interest_coverage']})")
            lines.append(f"  Net Profit Margin: {ratio_feature.net_profit_margin:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['net_profit_margin']})")
            lines.append(f"  Return on Assets: {ratio_feature.return_on_assets:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['return_on_assets']})")
            lines.append(f"  Return on Equity: {ratio_feature.return_on_equity:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['return_on_equity']})")
            lines.append(f"  Asset Turnover: {ratio_feature.asset_turnover:.3f} (benchmark {RATIO_BENCHMARKS_DISPLAY['asset_turnover']})")

        def _model_block(pred: Prediction | None, label: str) -> None:
            if pred is None:
                lines.append(f"{label}: not available for this assessment")
                return
            lines.append(f"{label}:")
            lines.append(f"  Risk Classification: {pred.risk_label}")
            lines.append(f"  Distress Probability: {pred.distress_probability * 100:.1f}%")
            try:
                shap = json.loads(pred.shap_values_json)
                top3 = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
                lines.append("  Top 3 SHAP Drivers:")
                for feat, val in top3:
                    direction = "increases" if val > 0 else "reduces"
                    display = RATIO_DISPLAY_NAMES.get(feat, feat)
                    lines.append(f"    {display}: {val:+.4f} ({direction} distress risk)")
            except Exception:
                pass
            if pred.narrative:
                excerpt = pred.narrative.content[:120].rstrip()
                lines.append(f"  Narrative excerpt: {excerpt}…")

        _model_block(rf, "Random Forest")
        _model_block(lr, "Logistic Regression")

        if rf is not None and lr is not None:
            agree = "Yes" if rf.risk_label == lr.risk_label else "No"
        elif rf is not None or lr is not None:
            agree = "N/A (only one model available)"
        else:
            agree = "N/A"
        lines.append(f"Models Agree: {agree}")

        assessed_at = (rf or lr).predicted_at if (rf or lr) else None
        lines.append(
            f"Assessed on: {assessed_at.strftime('%d %b %Y') if assessed_at else 'N/A'}"
        )
        lines.append("")

    return "\n".join(lines)



@router.post(
    "/",
    response_model=ChatResponse,
    summary="SME AI assistant — answer questions about predictions and financial ratios",
)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Process a chat message from the SME user."""
    if current_user.role != "sme_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SME owners can access this chat endpoint.",
        )

    is_blocked, count, cooldown_until = get_ai_usage_status(db, current_user.id)
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

    predictions_context = _build_predictions_context(current_user, db)
    system_prompt = build_chat_system_prompt(
        predictions_context=predictions_context,
        business_scale=current_user.business_scale or "medium_scale",
        user_role=current_user.role,
    )

    history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    try:
        reply, source = await generate_chat_response(
            system_prompt=system_prompt,
            history=history,
            message=request.message,
        )
    except Exception as exc:
        logger.error("Chat generation failed for user %d: %s", current_user.id, exc)
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
                portal_type="sme",
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
        "Chat response: user_id=%d source=%s chars=%d",
        current_user.id,
        source,
        len(reply),
    )
    return ChatResponse(
        reply=reply,
        source=source,
        current_count=final_count,
        cooldown_until=cooldown_until_new.isoformat() if cooldown_until_new else None,
        conversation_id=active_conversation_id,
        conversation_at_capacity=conversation_at_capacity,
    )
