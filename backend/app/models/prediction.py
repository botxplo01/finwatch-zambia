"""
FinWatch Zambia - Prediction Model

Stores the output of the ML inference pipeline for a given RatioFeature.
Includes risk label, probability, model used, and SHAP attributions.

Constraint: UniqueConstraint(ratio_feature_id, model_used) ensures one prediction per
(financial record, model) combination, allowing both LR and RF on the same record.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    __table_args__ = (
        UniqueConstraint(
            "ratio_feature_id",
            "model_used",
            name="uq_prediction_ratio_feature_model",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ratio_feature_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("ratio_features.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    model_used: Mapped[str] = mapped_column(String(30), nullable=False)
    risk_label: Mapped[str] = mapped_column(String(20), nullable=False)
    distress_probability: Mapped[float] = mapped_column(Float, nullable=False)
    shap_values_json: Mapped[str] = mapped_column(Text, nullable=False)
    prediction_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    predicted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    ratio_feature: Mapped["RatioFeature"] = relationship(  # noqa: F821
        "RatioFeature", back_populates="predictions"
    )

    narrative: Mapped["Narrative | None"] = relationship(  # noqa: F821
        "Narrative",
        back_populates="prediction",
        uselist=False,
        cascade="all, delete-orphan",
    )
    report: Mapped["Report | None"] = relationship(  # noqa: F821
        "Report",
        back_populates="prediction",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Prediction id={self.id} label={self.risk_label!r} "
            f"prob={self.distress_probability:.3f} model={self.model_used!r}>"
        )
