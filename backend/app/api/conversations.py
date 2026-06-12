"""
FinWatch Zambia - Conversation History API

CRUD endpoints for chat conversation threads.
All endpoints are scoped to the authenticated user.
Portal type is provided as a query parameter.
"""

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.models.user import User
from app.services import conversation_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ConversationListItem(BaseModel):
    id: int
    title: str
    preview: str
    updated_at: str
    user_message_count: int
    ai_response_count: int
    at_capacity: bool


class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[dict]
    user_message_count: int
    ai_response_count: int
    at_capacity: bool
    updated_at: str


class RenameRequest(BaseModel):
    title: str


class DeleteAllResponse(BaseModel):
    deleted_count: int


@router.get("/", response_model=List[ConversationListItem])
def list_conversations(
    portal_type: str = Query(..., description="'sme', 'institutional', 'sme_docs', 'regulator_docs', or 'analyst_docs'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all conversations for the authenticated user in the given portal."""
    if portal_type not in ("sme", "institutional", "sme_docs", "regulator_docs", "analyst_docs"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="portal_type must be one of: 'sme', 'institutional', 'sme_docs', 'regulator_docs', 'analyst_docs'.",
        )
    items = conversation_service.get_conversations(
        db, current_user.id, portal_type
    )
    return items


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Fetch a full conversation by ID."""
    conv = conversation_service.get_conversation(
        db, conversation_id, current_user.id
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    try:
        messages = json.loads(conv.messages_json)
    except Exception:
        messages = []

    at_capacity = (
        conv.user_message_count >= 20
        or conv.ai_response_count >= 20
    )
    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        messages=messages,
        user_message_count=conv.user_message_count,
        ai_response_count=conv.ai_response_count,
        at_capacity=at_capacity,
        updated_at=conv.updated_at.isoformat(),
    )


@router.put("/{conversation_id}", response_model=ConversationListItem)
def rename_conversation(
    conversation_id: int,
    payload: RenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Rename a conversation."""
    if not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty.",
        )
    conv = conversation_service.rename_conversation(
        db, conversation_id, current_user.id, payload.title
    )
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    # Return as list item shape
    return {
        "id": conv.id,
        "title": conv.title,
        "preview": "",
        "updated_at": conv.updated_at.isoformat(),
        "user_message_count": conv.user_message_count,
        "ai_response_count": conv.ai_response_count,
        "at_capacity": (
            conv.user_message_count >= 20
            or conv.ai_response_count >= 20
        ),
    }


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete a specific conversation."""
    deleted = conversation_service.delete_conversation(
        db, conversation_id, current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )


@router.delete("/", response_model=DeleteAllResponse)
def delete_all_conversations(
    portal_type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Delete all conversations for the user in the given portal."""
    if portal_type not in ("sme", "institutional", "sme_docs", "regulator_docs", "analyst_docs"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="portal_type must be one of: 'sme', 'institutional', 'sme_docs', 'regulator_docs', 'analyst_docs'.",
        )
    count = conversation_service.delete_all_conversations(
        db, current_user.id, portal_type
    )
    return DeleteAllResponse(deleted_count=count)
