"""
FinWatch Zambia - Documentation AI Assistant Router

Provides a dedicated AI chat endpoint for the documentation portal.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.dependencies import get_current_active_user
from app.models.user import User
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


DOCS_SYSTEM_PROMPT = """
You are the FinWatch Zambia Documentation Assistant. Your sole purpose is to help users understand the FinWatch Zambia system, its features, and the financial and technical concepts it uses.

STRICT RULES:
1. You may ONLY discuss: the FinWatch Zambia system and its features, financial concepts used in the system (ratios, distress prediction, SHAP, machine learning basics), how to use the platform, and what outputs mean.
2. You must NEVER discuss: anything unrelated to FinWatch Zambia, general financial advice, investment recommendations, legal advice, tax advice, competitor products, or any topic outside the system's scope.
3. If asked about anything outside your scope, respond with: "I can only help with questions about FinWatch Zambia and the concepts it uses. For other questions, please consult an appropriate professional."
4. Always use plain, accessible language. Define technical terms when you use them.
5. Give concrete Zambian business examples where helpful.
6. Keep responses concise — under 150 words unless the concept genuinely requires more detail.
7. Never fabricate features, data, or capabilities that do not exist in FinWatch Zambia.
8. If the user is on a specific documentation section (provided as context), anchor your response to that section's content first.

Current documentation section: {current_section}
"""


@router.post("/chat", response_model=DocsChatResponse)
async def documentation_chat(
    request: DocsChatRequest, current_user: User = Depends(get_current_active_user)
):
    """
    Documentation-specific AI chat endpoint.
    Requires an authenticated SME session.
    """
    # Authorization check
    if current_user.role != "sme_owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to SME owners.",
        )

    # Format the system prompt with current section
    system_prompt = DOCS_SYSTEM_PROMPT.format(
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
        return DocsChatResponse(reply=reply, source=source)
    except Exception as e:
        logger.error(f"DocsChat Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Documentation assistant encountered an error.",
        )
