"""
FinWatch Zambia - Chat Conversation Model

Stores AI assistant conversation threads per user per portal.
Messages are stored as a JSON array in a single Text column.
Storage is bounded: 25 conversations per user per portal (LRU eviction),
20 user messages + 20 AI responses per conversation.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    portal_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    title: Mapped[str] = mapped_column(
        String(120), nullable=False, default="New Conversation"
    )

    messages_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )

    # Cached counts for limit enforcement
    user_message_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    ai_response_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="chat_conversations")
