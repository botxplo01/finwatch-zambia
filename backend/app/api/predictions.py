# =============================================================================
# FinWatch Zambia — Predictions Router
#
# Endpoints:
#   GET  /api/predictions/                     — paginated history for current user
#   POST /api/predictions/                     — run a new prediction
#   GET  /api/predictions/{prediction_id}      — full detail with SHAP + narrative
#   DELETE /api/predictions/{prediction_id}    — delete a prediction record
#
# Pipeline per POST request:
#   1. Validate company ownership
#   2. Retrieve persisted RatioFeature for the given financial record
#   3. Build feature vector (ordered list matching training columns)
#   4. Run ML inference → risk_label, distress_probability
#   5. Compute SHAP attributions for the individual prediction
#   6. Compute prediction_hash from ratio values + model name
#   7. Check narrative cache — return cached narrative if hash matches
#   8. Call NLP service (Groq → Ollama → Template) to generate narrative
#   9. Persist Prediction + Narrative and return full response
# =============================================================================

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_active_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.schemas.prediction import PredictionResponse, PredictionSummaryResponse
from app.services.ml_service import predict
from app.services.nlp_service import compute_prediction_hash, generate_narrative
from app.services.ratio_engine import RATIO_NAMES
from app.services.shap_service import compute_shap_values

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# Helpers
# =============================================================================


def _resolve_ratio_feature(
    record_id: int,
    company_id: int,
    user: User,
    db: Session,
) -> RatioFeature:
    """
    Verify ownership chain (user → company → financial_record → ratio_feature)
    and return the RatioFeature. Raises appropriate HTTP errors at each step.
    """
    company = (
        db.query(Company)
        .filter(Company.id == company_id, Company.owner_id == user.id)
        .first()
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    record = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.id == record_id,
            FinancialRecord.company_id == company_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial record not found.",
        )

    ratio_feature = (
        db.query(RatioFeature)
        .filter(RatioFeature.financial_record_id == record_id)
        .first()
    )
    if not ratio_feature:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No ratio features found for this financial record. "
                "This record may have been created before the ratio engine was active."
            ),
        )
    return ratio_feature


def _ratio_feature_to_dict(rf: RatioFeature) -> dict[str, float]:
    """Convert a RatioFeature ORM object to a plain dict matching RATIO_NAMES."""
    return {name: getattr(rf, name) for name in RATIO_NAMES}


def _build_prediction_response(prediction: Prediction) -> PredictionResponse:
    """
    Assemble a PredictionResponse from a fully loaded Prediction ORM object.
    SHAP values are stored as JSON string — parse to dict before returning.
    """
    shap_dict = json.loads(prediction.shap_values_json)

    ratios_response = None
    if prediction.ratio_feature:
        from app.schemas.prediction import RatioFeatureResponse

        ratios_response = RatioFeatureResponse.model_validate(prediction.ratio_feature)

    narrative_response = None
    if prediction.narrative:
        from app.schemas.prediction import NarrativeResponse

        narrative_response = NarrativeResponse.model_validate(prediction.narrative)

    return PredictionResponse(
        id=prediction.id,
        model_used=prediction.model_used,
        risk_label=prediction.risk_label,
        distress_probability=prediction.distress_probability,
        shap_values=shap_dict,
        predicted_at=prediction.predicted_at,
        ratios=ratios_response,
        narrative=narrative_response,
    )


# =============================================================================
# GET /api/predictions/
# =============================================================================


@router.get(
    "/",
    response_model=list[PredictionSummaryResponse],
    summary="List prediction history for the current user",
)
def list_predictions(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns a paginated, lightweight list of all predictions made by the
    current user across all their companies.
    Ordered by prediction date descending (most recent first).
    """
    # Join through ratio_feature → financial_record → company to filter by owner
    results = (
        db.query(Prediction, Company.name.label("company_name"))
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Company.owner_id == current_user.id)
        .order_by(Prediction.predicted_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        PredictionSummaryResponse(
            id=pred.id,
            model_used=pred.model_used,
            risk_label=pred.risk_label,
            distress_probability=pred.distress_probability,
            predicted_at=pred.predicted_at,
            company_name=company_name,
        )
        for pred, company_name in results
    ]


# =============================================================================
# POST /api/predictions/
# =============================================================================


@router.post(
    "/",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Run a financial distress prediction for a financial record",
)
def create_prediction(
    company_id: int = Query(..., description="ID of the company being assessed"),
    record_id: int = Query(..., description="ID of the financial record to predict on"),
    model_name: str = Query(
        default="random_forest",
        description="ML model to use: 'random_forest' or 'logistic_regression'",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Run the full prediction pipeline for a given financial record:

    1. Verify ownership and retrieve ratio features
    2. Check if a prediction already exists for this record + model combination
    3. Run ML inference to obtain risk label and distress probability
    4. Compute SHAP attributions for interpretability
    5. Check narrative cache to avoid redundant API calls
    6. Generate NLP narrative via Groq → Ollama → Template fallback chain
    7. Persist prediction and narrative, return full response

    If a prediction already exists for this record + model, it is returned
    directly without re-running the pipeline (idempotent behaviour).
    """
    if model_name not in ("random_forest", "logistic_regression"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="model_name must be 'random_forest' or 'logistic_regression'.",
        )

    # Step 1: Verify ownership and retrieve ratio feature
    ratio_feature = _resolve_ratio_feature(record_id, company_id, current_user, db)

    # Step 2: Idempotency check — return existing prediction if present
    existing = (
        db.query(Prediction)
        .filter(
            Prediction.ratio_feature_id == ratio_feature.id,
            Prediction.model_used == model_name,
        )
        .options(
            joinedload(Prediction.ratio_feature),
            joinedload(Prediction.narrative),
        )
        .first()
    )
    if existing:
        logger.info(
            "Returning existing prediction id=%d for record_id=%d model=%s",
            existing.id,
            record_id,
            model_name,
        )
        return _build_prediction_response(existing)

    # Step 3: Build ratio dict and feature vector
    ratios = _ratio_feature_to_dict(ratio_feature)

    # Step 4: ML inference
    try:
        ml_result = predict(ratios=ratios, model_name=model_name)
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "ML models are not yet loaded. "
                "Run the training pipeline first: python ml/train.py"
            ),
        )

    risk_label: str = ml_result["risk_label"]
    distress_probability: float = ml_result["distress_probability"]

    # Step 5: SHAP attributions
    try:
        shap_values: dict[str, float] = compute_shap_values(
            model_name=model_name,
            feature_vector=list(ratios.values()),
        )
    except NotImplementedError:
        # SHAP not yet wired (pre-Stage 3) — use zero attributions as fallback
        logger.warning("SHAP service not yet implemented — using zero attributions")
        shap_values = {name: 0.0 for name in RATIO_NAMES}

    # Step 6: Prediction hash for narrative caching
    prediction_hash = compute_prediction_hash(ratios=ratios, model_used=model_name)

    # Step 7: Narrative cache check
    cached_narrative = (
        db.query(Narrative).filter(Narrative.cache_key == prediction_hash).first()
    )

    # Step 8: Persist the prediction first (narrative needs prediction.id)
    prediction = Prediction(
        ratio_feature_id=ratio_feature.id,
        model_used=model_name,
        risk_label=risk_label,
        distress_probability=distress_probability,
        shap_values_json=json.dumps(shap_values),
        prediction_hash=prediction_hash,
    )
    db.add(prediction)
    db.flush()  # get prediction.id without committing

    # Step 9: Generate or reuse narrative
    if cached_narrative:
        narrative_text = cached_narrative.content
        narrative_source = cached_narrative.source
        logger.info(
            "Narrative cache hit for hash=%s source=%s",
            prediction_hash[:8],
            narrative_source,
        )
    else:
        narrative_text, narrative_source = generate_narrative(
            risk_label=risk_label,
            distress_probability=distress_probability,
            shap_values=shap_values,
            ratios=ratios,
            model_used=model_name,
        )
        logger.info(
            "Narrative generated via %s for prediction hash=%s",
            narrative_source,
            prediction_hash[:8],
        )

    narrative = Narrative(
        prediction_id=prediction.id,
        content=narrative_text,
        source=narrative_source,
        cache_key=prediction_hash,
    )
    db.add(narrative)
    db.commit()

    # Reload with relationships for response assembly
    db.refresh(prediction)
    prediction = (
        db.query(Prediction)
        .options(
            joinedload(Prediction.ratio_feature),
            joinedload(Prediction.narrative),
        )
        .filter(Prediction.id == prediction.id)
        .first()
    )

    logger.info(
        "Prediction created: id=%d label=%s prob=%.3f model=%s source=%s",
        prediction.id,
        risk_label,
        distress_probability,
        model_name,
        narrative_source,
    )
    return _build_prediction_response(prediction)


# =============================================================================
# GET /api/predictions/{prediction_id}
# =============================================================================


@router.get(
    "/{prediction_id}",
    response_model=PredictionResponse,
    summary="Get full prediction detail with SHAP values and NLP narrative",
)
def get_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns the full prediction record including:
    - Risk label and distress probability
    - All 10 computed ratio values
    - SHAP attribution values per ratio
    - NLP-generated financial health narrative
    - Narrative source (groq / ollama / template)

    Ownership is verified — users can only access their own predictions.
    """
    prediction = (
        db.query(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            Prediction.id == prediction_id,
            Company.owner_id == current_user.id,
        )
        .options(
            joinedload(Prediction.ratio_feature),
            joinedload(Prediction.narrative),
        )
        .first()
    )
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found.",
        )
    return _build_prediction_response(prediction)


# =============================================================================
# DELETE /api/predictions/{prediction_id}
# =============================================================================


@router.delete(
    "/{prediction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a prediction and its associated narrative and report",
)
def delete_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Deletes the prediction and all associated data (narrative, report)
    via cascade. Ownership is verified before deletion.
    """
    prediction = (
        db.query(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            Prediction.id == prediction_id,
            Company.owner_id == current_user.id,
        )
        .first()
    )
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found.",
        )
    db.delete(prediction)
    db.commit()
    logger.info("Prediction deleted: id=%d user_id=%d", prediction_id, current_user.id)
