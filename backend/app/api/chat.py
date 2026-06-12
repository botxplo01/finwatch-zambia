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
    """Fetch the user's most recent 20 predictions and format them as a structured plain-text block."""
    results = (
        db.query(
            Prediction,
            Company.name.label("company_name"),
            FinancialRecord.period.label("period"),
        )
        .select_from(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Company.owner_id == user.id)
        .order_by(Prediction.predicted_at.desc())
        .limit(20)
        .all()
    )

    if not results:
        return ""

    lines = []
    for i, (pred, company_name, period) in enumerate(results, 1):
        model_label = (
            "Random Forest"
            if pred.model_used == "random_forest"
            else "Logistic Regression"
        )
        prob_pct = f"{pred.distress_probability * 100:.1f}%"

        lines.append(f"--- Prediction {i} ---")
        lines.append(f"Company: {company_name}")
        lines.append(f"Period: {period}")
        lines.append(f"Model: {model_label}")
        lines.append(f"Risk Classification: {pred.risk_label}")
        lines.append(f"Distress Probability: {prob_pct}")

        rf = pred.ratio_feature
        if rf:
            lines.append("Financial Ratios:")
            lines.append(f"  Current Ratio: {rf.current_ratio:.3f} (benchmark >= 1.5)")
            lines.append(f"  Quick Ratio: {rf.quick_ratio:.3f} (benchmark >= 1.0)")
            lines.append(f"  Cash Ratio: {rf.cash_ratio:.3f} (benchmark >= 0.2)")
            lines.append(
                f"  Debt-to-Equity: {rf.debt_to_equity:.3f} (benchmark <= 2.0)"
            )
            lines.append(
                f"  Debt-to-Assets: {rf.debt_to_assets:.3f} (benchmark <= 0.6)"
            )
            lines.append(
                f"  Interest Coverage: {rf.interest_coverage:.3f} (benchmark >= 2.0)"
            )
            lines.append(
                f"  Net Profit Margin: {rf.net_profit_margin:.3f} (benchmark >= 0.05)"
            )
            lines.append(
                f"  Return on Assets: {rf.return_on_assets:.3f} (benchmark >= 0.02)"
            )
            lines.append(
                f"  Return on Equity: {rf.return_on_equity:.3f} (benchmark >= 0.05)"
            )
            lines.append(
                f"  Asset Turnover: {rf.asset_turnover:.3f} (benchmark >= 0.5)"
            )

        try:
            shap = json.loads(pred.shap_values_json)
            top3 = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
            lines.append("Top SHAP Drivers:")
            for feat, val in top3:
                direction = "increases" if val > 0 else "reduces"
                lines.append(f"  {feat}: {val:+.4f} ({direction} distress risk)")
        except Exception:
            pass

        if pred.narrative:
            excerpt = pred.narrative.content[:120].rstrip()
            lines.append(f"Narrative excerpt: {excerpt}…")

        lines.append(
            f"Assessed on: {pred.predicted_at.strftime('%d %b %Y') if pred.predicted_at else 'N/A'}"
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
