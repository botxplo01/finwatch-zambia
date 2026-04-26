"""
FinWatch Zambia - Narrative Model

Stores the NLP-generated financial health narrative for a Prediction.
Tracks which inference source produced the narrative (groq/ollama/template)
and caches it to avoid redundant API calls on repeated identical inputs.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Narrative(Base):
    __tablename__ = "narratives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    prediction_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("predictions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    cache_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    prediction: Mapped["Prediction"] = relationship(  # noqa: F821
        "Prediction", back_populates="narrative"
    )

    def __repr__(self) -> str:
        return f"<Narrative id={self.id} source={self.source!r} prediction_id={self.prediction_id}>"
