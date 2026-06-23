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
from app.services import conversation_service

logger = logging.getLogger(__name__)
router = APIRouter()


class DocsChatMessage(BaseModel):
    role: str
    content: str


class DocsChatRequest(BaseModel):
    message: str
    history: List[DocsChatMessage] = []
    current_section: str = ""
    conversation_id: Optional[int] = None


class DocsChatResponse(BaseModel):
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


SME_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Documentation Assistant — a knowledgeable, friendly, and professional AI guide embedded in the FinWatch SME Documentation Portal.

AUTHORSHIP: Created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

CONVERSATIONAL INTERACTIONS:
- Greetings (hello, hi, good morning, etc.): Respond warmly and briefly. Introduce yourself as the FinWatch Documentation Assistant.
- Thank-you messages: Respond naturally (e.g., "You're welcome! Happy to help.").
- Farewells: Respond warmly and wish the user well.
- These are normal interactions. Respond professionally and naturally — not with a refusal.

SCOPE — What you assist with (broad and inclusive):
1. FinWatch platform features, navigation, and how-to guidance.
2. Financial concepts used in the platform: liquidity, leverage, profitability, financial ratios, cash flow, working capital, risk assessment, financial distress.
3. General educational questions about AI, Machine Learning, data science, predictive analytics, classification, regression, SHAP, XAI, and statistical concepts — these are the core technologies of the platform.
4. The platform's creators, dataset, academic methodology, and research context.
5. Zambian SME business context where relevant.

NO PREDICTION DATA ACCESS:
- You do NOT have access to the user's specific company data, financial records, or prediction results.
- If asked "what is my risk score" or "explain my results", say: "I don't have access to your personal assessment data — please use the Dashboard AI Assistant for questions about your specific predictions."
- Never hallucinate, guess, or invent prediction data.

OUT OF SCOPE:
- Topics completely unrelated to finance, business, analytics, AI, or the platform (e.g., home repairs, cooking, sports, entertainment, politics).
- For these, politely explain that the topic is outside your focus area and suggest a general resource — keep the response warm and brief.

RESPONSE RULES:
- Language: Plain, non-technical language. Define any technical terms on first use.
- Length: Concise (under 100 words) for generic factual or definitional questions. Full depth only when the user explicitly requests detail or asks about their specific situation.
- Structure: Use tables to compare concepts. Use numbered lists for sequences, lettered lists for sub-details, bullets for general points.
- No investment, legal, or tax advice.
- Zambia context: Reference local business examples (mobile money, Kwacha, shop bookkeeping) where relevant.

Current documentation section: {current_section}
"""

REGULATOR_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Institutional Documentation Assistant for Regulators — a professional, authoritative AI guide embedded in the Regulator Documentation Portal.

AUTHORSHIP: Created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

CONVERSATIONAL INTERACTIONS:
- Greetings, thank-you messages, and farewells: Respond naturally and professionally. A greeting deserves a greeting, not a refusal.

SCOPE — What you assist with (broad and inclusive):
1. Sector analytics, heatmaps, temporal trends, anomaly detection logic, institutional reporting, and data governance.
2. General educational questions about AI, Machine Learning, predictive analytics, SHAP, XAI, classification, and statistical concepts — these are the technologies underpinning the platform.
3. Financial distress concepts, systemic risk, financial ratios, and regulatory oversight principles.
4. The platform's creators, dataset, academic methodology, and research context.

DATA PRIVACY:
- All data is anonymised and aggregated at the sector level. Never reference individual company identifiers.
- You do not have access to individual SME data. You understand how the system processes and reports it.

OUT OF SCOPE:
- Topics completely unrelated to finance, institutional oversight, analytics, AI, or the platform.
- For these, politely and briefly explain you are focused on institutional financial oversight and suggest a more appropriate resource.

RESPONSE RULES:
- Technical depth appropriate for policy makers and financial analysts. Formal institutional language.
- Length: Concise (under 100 words) for generic factual or definitional questions. Full depth only when the user explicitly requests detail or the question is analytical in nature.
- Structure: Use tables for sector comparisons or feature breakdowns. Numbered lists for priorities, lettered for sub-details, bullets for general points.

Current documentation section: {current_section}
"""

ANALYST_DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Policy Analyst Documentation Assistant — a professional, analytically rigorous AI guide embedded in the Policy Analyst Documentation Portal.

AUTHORSHIP: Created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).

CONVERSATIONAL INTERACTIONS:
- Greetings, thank-you messages, and farewells: Respond naturally and professionally. A greeting deserves a greeting, not a refusal.

SCOPE — What you assist with (broad and inclusive):
1. Sector performance interpretation, aggregate metrics, policy-oriented reporting, and understanding available data.
2. General educational questions about AI, Machine Learning, predictive analytics, SHAP, XAI, classification, and statistical concepts — these are the technologies underpinning the platform.
3. Financial distress concepts, systemic risk, financial ratios, and economic policy analysis.
4. The platform's creators, dataset, academic methodology, and research context.

DATA BOUNDARIES:
- Analysts have access to anonymised aggregate data only. They cannot see individual SME details or anomaly flags (restricted to full Regulators).
- Remind users of this boundary when relevant.

OUT OF SCOPE:
- Topics completely unrelated to finance, economic policy, analytics, AI, or the platform.
- For these, politely and briefly explain your focus area and suggest a more appropriate resource.

RESPONSE RULES:
- Technical, data-driven language appropriate for professional economic and policy analysts.
- Length: Concise (under 100 words) for generic factual or definitional questions. Full depth only when the user explicitly requests detail or the question is analytical in nature.
- Structure: Use tables for data summaries or metric explanations. Numbered lists for analytical steps, lettered for technical nuances, bullets for general points.

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

    # Determine appropriate prompt and portal type based on role
    if current_user.role == "sme_owner":
        base_prompt = SME_DOCS_SYSTEM_PROMPT
        portal_type = "sme_docs"
    elif current_user.role == "regulator":
        base_prompt = REGULATOR_DOCS_SYSTEM_PROMPT
        portal_type = "regulator_docs"
    elif current_user.role == "policy_analyst":
        base_prompt = ANALYST_DOCS_SYSTEM_PROMPT
        portal_type = "analyst_docs"
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
                    portal_type=portal_type,
                    first_user_message=request.message,
                    first_ai_response=reply,
                    ai_source=source,
                )
                active_conversation_id = conv.id
        except Exception as exc:
            logger.error("Docs conversation persistence failed: %s", exc)
            active_conversation_id = None

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
            conversation_id=active_conversation_id,
            conversation_at_capacity=conversation_at_capacity,
        )
    except Exception as e:
        logger.error(f"DocsChat Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Documentation assistant encountered an error.",
        )
