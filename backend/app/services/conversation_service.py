"""
FinWatch Zambia - Conversation Service

CRUD operations for ChatConversation records.
All message appends update cached counts. All queries are bounded
and use no joins. LRU eviction keeps storage costs flat.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import (
    CONVERSATION_LIMIT,
    CONVERSATION_MAX_AI_RESPONSES,
    CONVERSATION_MAX_USER_MESSAGES,
)
from app.models.chat_conversation import ChatConversation

logger = logging.getLogger(__name__)


def _truncate_title(text: str, max_chars: int = 80) -> str:
    """Derive a conversation title from the first user message."""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


def _enforce_conversation_limit(
    db: Session, user_id: int, portal_type: str
) -> None:
    """
    If the user has reached CONVERSATION_LIMIT, delete the oldest
    conversation (LRU eviction) to make room for the new one.
    Operates within the caller's transaction — no commit here.
    """
    count = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.user_id == user_id,
            ChatConversation.portal_type == portal_type,
        )
        .count()
    )
    if count >= CONVERSATION_LIMIT:
        oldest = (
            db.query(ChatConversation)
            .filter(
                ChatConversation.user_id == user_id,
                ChatConversation.portal_type == portal_type,
            )
            .order_by(ChatConversation.updated_at.asc())
            .first()
        )
        if oldest:
            db.delete(oldest)
            db.flush()
            logger.info(
                "LRU eviction: deleted oldest conversation id=%d "
                "for user_id=%d portal=%s",
                oldest.id, user_id, portal_type,
            )


def create_conversation(
    db: Session,
    user_id: int,
    portal_type: str,
    first_user_message: str,
    first_ai_response: str,
    ai_source: str = "groq",
) -> ChatConversation:
    """
    Create a new conversation with the first exchange already appended.
    Enforces LRU eviction before creation.
    Commits the transaction.
    """
    _enforce_conversation_limit(db, user_id, portal_type)

    title = _truncate_title(first_user_message)
    now = datetime.now(timezone.utc)

    messages = [
        {
            "role": "user",
            "content": first_user_message,
            "timestamp": now.isoformat(),
        },
        {
            "role": "assistant",
            "content": first_ai_response,
            "source": ai_source,
            "timestamp": now.isoformat(),
        },
    ]

    conversation = ChatConversation(
        user_id=user_id,
        portal_type=portal_type,
        title=title,
        messages_json=json.dumps(messages),
        user_message_count=1,
        ai_response_count=1,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    logger.info(
        "Created conversation id=%d for user_id=%d portal=%s",
        conversation.id, user_id, portal_type,
    )
    return conversation


def append_messages(
    db: Session,
    conversation_id: int,
    user_id: int,
    user_message: str,
    ai_response: str,
    ai_source: str = "groq",
) -> ChatConversation | None:
    """
    Append a user message and AI response to an existing conversation.
    Returns None if the conversation is at capacity or not found.
    Commits the transaction.
    """
    conversation = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
        )
        .first()
    )
    if not conversation:
        return None

    # Enforce per-conversation limits using cached counts
    if conversation.user_message_count >= CONVERSATION_MAX_USER_MESSAGES:
        return None  # Caller should start a new conversation
    if conversation.ai_response_count >= CONVERSATION_MAX_AI_RESPONSES:
        return None

    messages = json.loads(conversation.messages_json)
    now = datetime.now(timezone.utc)

    messages.append({
        "role": "user",
        "content": user_message,
        "timestamp": now.isoformat(),
    })
    messages.append({
        "role": "assistant",
        "content": ai_response,
        "source": ai_source,
        "timestamp": now.isoformat(),
    })

    conversation.messages_json = json.dumps(messages)
    conversation.user_message_count += 1
    conversation.ai_response_count += 1

    db.commit()
    db.refresh(conversation)
    return conversation


def is_conversation_at_capacity(
    db: Session, conversation_id: int, user_id: int
) -> bool:
    """Check if a conversation has reached its message limits."""
    conv = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
        )
        .first()
    )
    if not conv:
        return True
    return (
        conv.user_message_count >= CONVERSATION_MAX_USER_MESSAGES
        or conv.ai_response_count >= CONVERSATION_MAX_AI_RESPONSES
    )


def get_conversations(
    db: Session, user_id: int, portal_type: str
) -> list[dict]:
    """
    Return conversation list items for the history panel.
    Each item includes id, title, updated_at, and a preview string.
    The preview is the last non-system message content, truncated to 120 chars.
    Does NOT return messages_json in full — minimises payload size.
    """
    conversations = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.user_id == user_id,
            ChatConversation.portal_type == portal_type,
        )
        .order_by(ChatConversation.updated_at.desc())
        .all()
    )

    result = []
    for conv in conversations:
        preview = ""
        try:
            messages = json.loads(conv.messages_json)
            # Find last non-system message
            for msg in reversed(messages):
                if msg.get("role") in ("user", "assistant"):
                    preview = msg.get("content", "")[:120]
                    break
        except Exception:
            pass

        result.append({
            "id": conv.id,
            "title": conv.title,
            "preview": preview,
            "updated_at": conv.updated_at.isoformat(),
            "user_message_count": conv.user_message_count,
            "ai_response_count": conv.ai_response_count,
            "at_capacity": (
                conv.user_message_count >= CONVERSATION_MAX_USER_MESSAGES
                or conv.ai_response_count >= CONVERSATION_MAX_AI_RESPONSES
            ),
        })
    return result


def get_conversation(
    db: Session, conversation_id: int, user_id: int
) -> ChatConversation | None:
    """Fetch a full conversation by ID, owned by the given user."""
    return (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
        )
        .first()
    )


def rename_conversation(
    db: Session, conversation_id: int, user_id: int, new_title: str
) -> ChatConversation | None:
    """Rename a conversation. Returns None if not found."""
    conversation = get_conversation(db, conversation_id, user_id)
    if not conversation:
        return None
    conversation.title = new_title.strip()[:120]
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(
    db: Session, conversation_id: int, user_id: int
) -> bool:
    """Delete a specific conversation. Returns True if deleted."""
    conversation = get_conversation(db, conversation_id, user_id)
    if not conversation:
        return False
    db.delete(conversation)
    db.commit()
    return True


def delete_all_conversations(
    db: Session, user_id: int, portal_type: str
) -> int:
    """Delete all conversations for a user and portal. Returns count deleted."""
    deleted = (
        db.query(ChatConversation)
        .filter(
            ChatConversation.user_id == user_id,
            ChatConversation.portal_type == portal_type,
        )
        .all()
    )
    count = len(deleted)
    for conv in deleted:
        db.delete(conv)
    db.commit()
    logger.info(
        "Deleted %d conversations for user_id=%d portal=%s",
        count, user_id, portal_type,
    )
    return count
