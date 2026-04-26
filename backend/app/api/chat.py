"""
FinWatch Zambia - Chat Router (SME Portal)

Endpoint: POST /api/chat — conversational AI assistant for SME prediction queries.

Design:
- Fetches the authenticated user's most recent predictions (up to 20) and injects them as context
- Accepts conversation history from the frontend for stateless backend, stateful frontend
- Calls generate_chat_response() which runs the 4-tier fallback chain
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.services.nlp_service import build_chat_system_prompt, generate_chat_response

logger = logging.getLogger(__name__)
router = APIRouter()




class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    source: str




def _build_predictions_context(user: User, db: Session) -> str:
    """Fetch the user's most recent 20 predictions and format them as a structured plain-text block."""
    results = (
        db.query(
            Prediction,
            Company.name.label("company_name"),
            FinancialRecord.period.label("period"),
        )
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
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Process a chat message from the SME user."""
    if current_user.role != "sme_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SME owners can access this chat endpoint.",
        )

    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    predictions_context = _build_predictions_context(current_user, db)
    system_prompt = build_chat_system_prompt(predictions_context)

    history = [{"role": msg.role, "content": msg.content} for msg in request.history]

    try:
        reply, source = generate_chat_response(
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

    logger.info(
        "Chat response: user_id=%d source=%s chars=%d",
        current_user.id,
        source,
        len(reply),
    )
    return ChatResponse(reply=reply, source=source)
