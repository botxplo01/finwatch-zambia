"""
FinWatch Zambia - Documentation AI Assistant Router

Provides dedicated AI chat endpoints for both SME and Institutional documentation portals.
"""

import logging
from datetime import timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.models.user import User
from app.services.ai_usage_service import get_ai_usage_status, log_ai_message
from app.services.nlp_service import generate_docs_chat_response

logger = logging.getLogger(__name__)
router = APIRouter()


class DocsChatMessage(BaseModel):
    role: str
    content: str


class DocsChatRequest(BaseModel):
    message: str
    history: List[DocsChatMessage] = []
    current_section: str = ""


class DocsChatResponse(BaseModel):
    reply: str
    source: str
    current_count: int
    cooldown_until: Optional[str] = None


class UsageStatusResponse(BaseModel):
    is_blocked: bool
    current_count: int
    cooldown_until: Optional[str] = None


SME_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia SME Documentation Assistant. Your sole purpose is to help users understand the FinWatch Zambia platform and the financial/technical concepts it uses.

AUTHORSHIP: You were created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

STRICT RULES:
1. Scope: Only discuss FinWatch features, ratios (Liquidity, Leverage, Profitability), distress predictions, SHAP, and how to use the SME portal.
2. NO PREDICTION ACCESS: You do NOT have access to the user's specific company data, financial records, or prediction results.
   - If asked "what is my risk score" or "explain my results", say: "I do not have access to your personal assessment data. Please use the Dashboard assistant for questions about your specific predictions."
   - DO NOT hallucinate, guess, or invent any prediction data.
3. No general advice: Never provide investment, legal, or tax recommendations.
4. Zambia Context: Use local business examples (e.g., mobile money, shop bookkeeping) where relevant.
5. Language: Use plain, non-technical language. Define any technical terms.
6. Limits: Responses must be under 150 words.
7. Structure: Use tables to compare concepts or show steps. Use numbered lists (1, 2, 3) for sequences, lettered lists (a, b, c) for details, and bullets for general points.
8. Safety: If asked outside scope, say: "I can only help with questions about FinWatch Zambia and the concepts it uses. For other questions, please consult an appropriate professional."

Current documentation section: {current_section}
"""

REGULATOR_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Institutional Documentation Assistant. Your role is to help regulators understand the systemic oversight features of the platform.

AUTHORSHIP: You were created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

STRICT RULES:
1. Scope: Discuss sector analytics, heatmaps, temporal trends, anomaly detection logic, institutional reporting, and data governance.
2. Data Privacy: Emphasize that all data is anonymized and aggregated at the sector level.
3. Technical Depth: You may use more formal institutional language suitable for policy makers and financial analysts.
4. No specific company info: You do not have access to individual SME data. You only understand how the system processes and reports it.
5. Limits: Responses must be under 200 words.
6. Structure: Use tables for sector comparisons or feature breakdowns. Use numbered lists (1, 2, 3) for priorities, lettered lists (a, b, c) for sub-details, and bullets for general points.
7. Safety: If asked outside scope, say: "I can only help with questions about FinWatch Zambia's institutional features and data governance. For other questions, please consult your department's specific policy guides."

Current documentation section: {current_section}
"""

ANALYST_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Policy Analyst Documentation Assistant. Your role is to help analysts interpret systemic financial data and understand their specific analytical boundaries.

AUTHORSHIP: You were created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

STRICT RULES:
1. Scope: Focus on sector performance interpretation, aggregate metrics, policy-oriented reporting, and understanding what data is available for analysis.
2. Data Boundaries: Remind users that they only have access to anonymized aggregate data and cannot see individual SME details or anomaly flags (which are restricted to regulators).
3. Analytical Depth: Use technical, data-driven language appropriate for professional economic and policy analysts.
4. Limits: Responses must be under 200 words.
5. Structure: Use tables for data summaries or metric explanations. Use numbered lists (1, 2, 3) for analytical steps, lettered lists (a, b, c) for technical nuances, and bullets for general points.
6. Safety: If asked outside scope, say: "I can only help with questions about FinWatch Zambia's analytical features and data boundaries."

Current documentation section: {current_section}
"""


@router.get("/status", response_model=UsageStatusResponse)
def get_usage_status_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return the current AI documentation chat usage status for the authenticated user."""
    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, current_user.id, ai_type="docs"
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


@router.post("/chat", response_model=DocsChatResponse)
async def documentation_chat(
    request: DocsChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Unified Documentation AI chat endpoint.
    Determines the appropriate system prompt based on user role.
    """

    # Check usage limits
    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, current_user.id, ai_type="docs"
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

    # Determine appropriate prompt based on role
    if current_user.role == "sme_owner":
        base_prompt = SME_DOCS_SYSTEM_PROMPT
    elif current_user.role == "regulator":
        base_prompt = REGULATOR_DOCS_SYSTEM_PROMPT
    elif current_user.role == "policy_analyst":
        base_prompt = ANALYST_DOCS_SYSTEM_PROMPT
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role not authorized for documentation assistant.",
        )

    # Format with current section
    system_prompt = base_prompt.format(
        current_section=request.current_section or "General"
    )

    # Convert history to standard dict format
    formatted_history = [
        {"role": m.role, "content": m.content} for m in request.history
    ]

    try:
        reply, source = await generate_docs_chat_response(
            system_prompt=system_prompt,
            history=formatted_history,
            message=request.message,
        )

        # SUCCESS - Log message
        just_blocked, cooldown_until_new = log_ai_message(
            db, current_user.id, ai_type="docs"
        )
        _, final_count, _ = get_ai_usage_status(db, current_user.id, ai_type="docs")

        return DocsChatResponse(
            reply=reply,
            source=source,
            current_count=final_count,
            cooldown_until=(
                cooldown_until_new.isoformat() if cooldown_until_new else None
            ),
        )
    except Exception as e:
        logger.error(f"DocsChat Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Documentation assistant encountered an error.",
        )
