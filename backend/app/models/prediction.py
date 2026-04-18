# =============================================================================
# FinWatch Zambia — Prediction Model
# Stores the output of the ML inference pipeline for a given RatioFeature.
# Includes risk label, probability, model used, and SHAP attributions.
#
# Constraints:
#   UniqueConstraint(ratio_feature_id, model_used) — one prediction per
#   (financial record, model) combination. This allows both Logistic
#   Regression and Random Forest to be run on the same record independently,
#   while preventing duplicate predictions from the same model on the same
#   record. The predictions router enforces this at the application layer;
#   this constraint is the database-level safety net.
# =============================================================================

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

    # CRITICAL: Uniqueness is on (ratio_feature_id, model_used) — NOT on
    # ratio_feature_id alone. A column-level unique=True on ratio_feature_id
    # would prevent running both LR and RF on the same financial record.
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
        # NOTE: No unique=True here — uniqueness is enforced via the
        # composite UniqueConstraint above, allowing one prediction per
        # (ratio_feature_id, model_used) pair rather than per ratio_feature_id.
    )

    # -------------------------------------------------------------------------
    # Model Selection
    # "logistic_regression" | "random_forest"
    # -------------------------------------------------------------------------
    model_used: Mapped[str] = mapped_column(String(30), nullable=False)

    # -------------------------------------------------------------------------
    # Prediction Output
    # "Distressed" | "Healthy"
    # -------------------------------------------------------------------------
    risk_label: Mapped[str] = mapped_column(String(20), nullable=False)

    # Probability of distress (0.0 – 1.0)
    distress_probability: Mapped[float] = mapped_column(Float, nullable=False)

    # -------------------------------------------------------------------------
    # SHAP Attributions
    # Stored as a JSON string: {"ratio_name": shap_value, ...}
    # Parsed by the API layer into a structured dict before returning to client.
    # JSON storage avoids a separate shap_values table while keeping the data
    # fully recoverable and human-readable in the raw database.
    # -------------------------------------------------------------------------
    shap_values_json: Mapped[str] = mapped_column(Text, nullable=False)

    # SHA-256 hash of (ratio_values + model_used) — used as a cache key for
    # NLP narratives. If the same financial profile is submitted again,
    # the stored narrative is returned without a new Groq/Ollama API call.
    prediction_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    predicted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    ratio_feature: Mapped["RatioFeature"] = relationship(  # noqa: F821
        "RatioFeature", back_populates="prediction"
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
