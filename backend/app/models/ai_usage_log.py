"""FinWatch Zambia - AI Usage Log Model

Database model for chat usage rate limiting.

Each row represents a single message timestamp used to enforce a rolling limit.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    user: Mapped["User"] = relationship("User", back_populates="ai_usage_logs")

    def __repr__(self) -> str:
        return f"<AIUsageLog id={self.id} user_id={self.user_id} timestamp={self.timestamp}>"
