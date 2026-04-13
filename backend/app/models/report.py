# =============================================================================
# FinWatch Zambia — Report Model
# Tracks generated PDF assessment reports linked to a Prediction.
# =============================================================================

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    prediction_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("predictions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Filename of the generated PDF stored on disk
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # File path relative to project root
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    prediction: Mapped["Prediction"] = relationship(  # noqa: F821
        "Prediction", back_populates="report"
    )

    def __repr__(self) -> str:
        return f"<Report id={self.id} file={self.filename!r}>"
