"""
FinWatch Zambia - Predictions Router

Handles ML financial distress assessments, model execution, SHAP attributions, and assessment management.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.business_rules import requires_full_assessment
from app.core.dependencies import get_current_sme_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User
from app.schemas.prediction import (
    AssessmentResponse,
    AssessmentSummaryResponse,
    PaginatedAssessmentResponse,
    PaginatedPredictionResponse,
    PredictionResponse,
    PredictionSummaryResponse,
)
from app.services.extraction_service import parse_financial_document
from app.services.ml_service import predict
from app.services.nlp_service import compute_prediction_hash, generate_narrative
from app.services.ratio_engine import RATIO_NAMES
from app.services.shap_service import compute_shap_values

logger = logging.getLogger(__name__)
router = APIRouter()

# Internal helpers


@router.post(
    "/extract-data",
    summary="Extract financial data from uploaded Balance Sheet and Income Statement documents",
)
async def extract_financial_data(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_sme_user),
):
    """Parse uploaded documents and return extracted financial values."""
    if len(files) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one document is required for extraction.",
        )

    all_extracted_data = {}

    try:
        for file in files:
            content = await file.read()
            extracted = await parse_financial_document(content, file.filename)

            # Log extraction success/failure per file
            non_zero_count = sum(1 for v in extracted.values() if v != 0.0)
            logger.info(
                f"Extracted {non_zero_count} non-zero values from {file.filename}"
            )

            # Merge data, prioritising non-zero values
            for key, value in extracted.items():
                if value != 0.0 or key not in all_extracted_data:
                    all_extracted_data[key] = value

        # Log final merged results
        final_non_zero_count = sum(1 for v in all_extracted_data.values() if v != 0.0)
        logger.info(f"Final merged data has {final_non_zero_count} non-zero values")

        return all_extracted_data
    except ValueError as e:
        logger.warning(f"Extraction failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Financial data extraction is currently unavailable. Please try again later or enter data manually.",
        )


def _resolve_ratio_feature(
    record_id: int,
    company_id: int,
    user: User,
    db: Session,
) -> RatioFeature:
    """Verify ownership chain and return the RatioFeature."""
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
            detail="No ratio features found for this financial record.",
        )
    return ratio_feature


def _ratio_feature_to_dict(rf: RatioFeature) -> dict[str, float]:
    """Convert RatioFeature ORM object to dict matching RATIO_NAMES."""
    return {name: getattr(rf, name) for name in RATIO_NAMES}


def _build_prediction_response(prediction: Prediction) -> PredictionResponse:
    """Assemble PredictionResponse from Prediction ORM object."""
    shap_dict = json.loads(prediction.shap_values_json)

    ratios_response = None
    if prediction.ratio_feature:
        from app.schemas.prediction import RatioFeatureResponse

        ratios_response = RatioFeatureResponse.model_validate(prediction.ratio_feature)

    narrative_response = None
    if prediction.narrative:
        from app.schemas.prediction import NarrativeResponse

        narrative_response = NarrativeResponse.model_validate(prediction.narrative)

    inputs_response = None
    if prediction.ratio_feature and prediction.ratio_feature.financial_record:
        from app.schemas.financial_record import FinancialRecordResponse

        inputs_response = FinancialRecordResponse.model_validate(
            prediction.ratio_feature.financial_record
        )

    return PredictionResponse(
        id=prediction.id,
        model_used=prediction.model_used,
        risk_label=prediction.risk_label,
        distress_probability=prediction.distress_probability,
        shap_values=shap_dict,
        predicted_at=prediction.predicted_at,
        assessment_methodology=prediction.assessment_methodology,
        ratios=ratios_response,
        narrative=narrative_response,
        inputs=inputs_response,
    )


def _build_assessment_response(
    ratio_feature_id: int,
    company_id: int,
    company_name: str,
    period: str,
    methodology: str,
    rf_prediction: Prediction | None,
    lr_prediction: Prediction | None,
) -> AssessmentResponse:
    """Assemble AssessmentResponse from individual model Prediction rows."""
    rf_resp = _build_prediction_response(rf_prediction) if rf_prediction else None
    lr_resp = _build_prediction_response(lr_prediction) if lr_prediction else None

    if rf_resp is not None and lr_resp is not None:
        models_agree: bool | None = rf_resp.risk_label == lr_resp.risk_label
    else:
        models_agree = None

    timestamps = [
        p.predicted_at for p in (rf_prediction, lr_prediction) if p is not None
    ]
    predicted_at = max(timestamps)

    return AssessmentResponse(
        ratio_feature_id=ratio_feature_id,
        company_id=company_id,
        company_name=company_name,
        period=period,
        assessment_methodology=methodology,
        random_forest=rf_resp,
        logistic_regression=lr_resp,
        models_agree=models_agree,
        predicted_at=predicted_at,
    )


# Per-model pipeline (run once per model inside create_prediction)


async def _run_model_pipeline(
    model_name: str,
    ratio_feature: RatioFeature,
    ratios: dict[str, float],
    record_id: int,
    methodology: str,
    company: Company,
    current_user: User,
    db: Session,
) -> Prediction | None:
    """
    Run the full ML → SHAP → narrative pipeline for one model.

    Returns the committed Prediction on success, or None on any error.
    The narrative generation coroutine is returned separately so the caller
    can gather both models' narrative calls concurrently.
    """
    # Idempotency check — return cached row immediately if it exists
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
        if existing.assessment_methodology != methodology:
            logger.warning(
                "Existing %s prediction (id=%d) has methodology=%s but required %s — skipping re-run",
                model_name,
                existing.id,
                existing.assessment_methodology,
                methodology,
            )
            return None
        logger.info(
            "Returning existing prediction id=%d for record_id=%d model=%s",
            existing.id,
            record_id,
            model_name,
        )
        return existing

    # ML inference
    try:
        ml_result = predict(ratios=ratios, model_name=model_name)
    except (NotImplementedError, RuntimeError) as exc:
        logger.error("ML inference failed for model=%s: %s", model_name, exc)
        return None

    risk_label: str = ml_result["risk_label"]
    distress_probability: float = ml_result["distress_probability"]

    # SHAP
    try:
        shap_values: dict[str, float] = compute_shap_values(
            model_name=model_name,
            feature_vector=list(ratios.values()),
        )
    except NotImplementedError:
        logger.warning("SHAP service not yet implemented — using zero attributions")
        shap_values = {name: 0.0 for name in RATIO_NAMES}

    prediction_hash = compute_prediction_hash(ratios=ratios, model_used=model_name)

    # Narrative cache check
    cached_narrative = (
        db.query(Narrative).filter(Narrative.cache_key == prediction_hash).first()
    )

    prediction = Prediction(
        ratio_feature_id=ratio_feature.id,
        model_used=model_name,
        risk_label=risk_label,
        distress_probability=distress_probability,
        shap_values_json=json.dumps(shap_values),
        prediction_hash=prediction_hash,
        assessment_methodology=methodology,
    )
    db.add(prediction)
    db.flush()

    if cached_narrative:
        narrative_text = cached_narrative.content
        narrative_source = cached_narrative.source
        logger.info(
            "Narrative cache hit for hash=%s source=%s",
            prediction_hash[:8],
            narrative_source,
        )
    else:
        record = (
            db.query(FinancialRecord).filter(FinancialRecord.id == record_id).first()
        )
        period = record.period if record else None

        narrative_text, narrative_source = await generate_narrative(
            risk_label=risk_label,
            distress_probability=distress_probability,
            shap_values=shap_values,
            ratios=ratios,
            model_used=model_name,
            period=period,
            business_scale=current_user.business_scale or "medium_scale",
            industry=company.industry,
        )
        logger.info(
            "Narrative generated via %s for model=%s hash=%s",
            narrative_source,
            model_name,
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

    # Reload with relationships
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
    return prediction


# List assessments (one row per financial record)


@router.get(
    "/",
    response_model=PaginatedAssessmentResponse,
    summary="List assessment history (one row per financial record, both models combined)",
)
def list_predictions(
    company_id: int | None = Query(default=None),
    ratio_feature_id: int | None = Query(default=None),
    model_name: str | None = Query(
        default=None,
        description="Only include assessments where this specific model produced a result",
    ),
    risk_level: str | None = Query(default=None),
    status_label: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    methodology: str | None = Query(default=None),
    search: str | None = Query(default=None, description="Case-insensitive search against company name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Return paginated assessments grouped by ratio_feature_id (one row per financial record)."""
    # Base query: one row per distinct ratio_feature_id owned by the user
    # We collect the minimal data needed for AssessmentSummaryResponse here
    # and load the Prediction rows per group below.

    rf_query = (
        db.query(RatioFeature.id)
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .join(Prediction, Prediction.ratio_feature_id == RatioFeature.id)
        .filter(Company.owner_id == current_user.id)
    )

    if company_id:
        rf_query = rf_query.filter(Company.id == company_id)
    if ratio_feature_id:
        rf_query = rf_query.filter(RatioFeature.id == ratio_feature_id)
    if model_name:
        rf_query = rf_query.filter(Prediction.model_used == model_name)
    if methodology:
        rf_query = rf_query.filter(Prediction.assessment_methodology == methodology)
    if search:
        rf_query = rf_query.filter(Company.name.ilike(f"%{search}%"))

    # Risk / status filters: include assessment if EITHER model satisfies it
    if status_label:
        rf_query = rf_query.filter(Prediction.risk_label == status_label)

    if risk_level:
        if risk_level.lower() == "high":
            rf_query = rf_query.filter(Prediction.distress_probability >= 0.7)
        elif risk_level.lower() == "medium":
            rf_query = rf_query.filter(
                Prediction.distress_probability >= 0.4,
                Prediction.distress_probability < 0.7,
            )
        elif risk_level.lower() == "low":
            rf_query = rf_query.filter(Prediction.distress_probability < 0.4)

    if start_date:
        try:
            dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            rf_query = rf_query.filter(Prediction.predicted_at >= dt)
        except ValueError:
            pass

    if end_date:
        try:
            dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            rf_query = rf_query.filter(Prediction.predicted_at <= dt)
        except ValueError:
            pass

    # Distinct ratio_feature_ids matching all criteria
    distinct_rf_ids_query = rf_query.distinct()
    total = distinct_rf_ids_query.count()

    paginated_rf_ids = [
        row[0]
        for row in distinct_rf_ids_query.order_by(RatioFeature.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    ]

    if not paginated_rf_ids:
        return {"items": [], "total": total, "skip": skip, "limit": limit}

    items: list[AssessmentSummaryResponse] = []

    for rf_id in paginated_rf_ids:
        # Metadata: company, period, methodology
        row = (
            db.query(
                Company.id.label("company_id"),
                Company.name.label("company_name"),
                FinancialRecord.period.label("period"),
            )
            .select_from(RatioFeature)
            .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
            .join(Company, FinancialRecord.company_id == Company.id)
            .filter(RatioFeature.id == rf_id)
            .first()
        )
        if not row:
            continue

        predictions = (
            db.query(Prediction)
            .filter(Prediction.ratio_feature_id == rf_id)
            .all()
        )

        pred_by_model: dict[str, Prediction] = {p.model_used: p for p in predictions}
        rf_pred = pred_by_model.get("random_forest")
        lr_pred = pred_by_model.get("logistic_regression")

        methodology_val = (
            rf_pred.assessment_methodology
            if rf_pred
            else (lr_pred.assessment_methodology if lr_pred else "")
        )

        all_timestamps = [p.predicted_at for p in predictions]
        latest_ts = max(all_timestamps) if all_timestamps else datetime.utcnow()

        if rf_pred and lr_pred:
            agrees: bool | None = rf_pred.risk_label == lr_pred.risk_label
        else:
            agrees = None

        items.append(
            AssessmentSummaryResponse(
                ratio_feature_id=rf_id,
                company_id=row.company_id,
                company_name=row.company_name,
                period=row.period,
                assessment_methodology=methodology_val,
                random_forest_risk_label=rf_pred.risk_label if rf_pred else None,
                random_forest_probability=rf_pred.distress_probability if rf_pred else None,
                logistic_regression_risk_label=lr_pred.risk_label if lr_pred else None,
                logistic_regression_probability=lr_pred.distress_probability if lr_pred else None,
                models_agree=agrees,
                predicted_at=latest_ts,
            )
        )

    return {"items": items, "total": total, "skip": skip, "limit": limit}




@router.post(
    "/",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Run both ML models on a financial record and return a combined AssessmentResponse",
)
async def create_prediction(
    company_id: int = Query(..., description="ID of the company being assessed"),
    record_id: int = Query(..., description="ID of the financial record to predict on"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Run full dual-model pipeline: ML inference, SHAP, and NLP narrative for both models."""
    ratio_feature = _resolve_ratio_feature(record_id, company_id, current_user, db)

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found.",
        )

    is_full = requires_full_assessment(current_user.business_scale, company.industry)
    methodology = "full" if is_full else "indicative"

    record = db.query(FinancialRecord).filter(FinancialRecord.id == record_id).first()
    period = record.period if record else ""

    ratios = _ratio_feature_to_dict(ratio_feature)

    # ML inference and SHAP are synchronous/fast; narrative generation is the async
    # network-bound step. The coroutines are awaited together via asyncio.gather.
    rf_task = _run_model_pipeline(
        model_name="random_forest",
        ratio_feature=ratio_feature,
        ratios=ratios,
        record_id=record_id,
        methodology=methodology,
        company=company,
        current_user=current_user,
        db=db,
    )
    lr_task = _run_model_pipeline(
        model_name="logistic_regression",
        ratio_feature=ratio_feature,
        ratios=ratios,
        record_id=record_id,
        methodology=methodology,
        company=company,
        current_user=current_user,
        db=db,
    )

    rf_prediction, lr_prediction = await asyncio.gather(rf_task, lr_task)

    if rf_prediction is None and lr_prediction is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not yet loaded. Run the training pipeline first: python ml/train.py",
        )

    return _build_assessment_response(
        ratio_feature_id=ratio_feature.id,
        company_id=company.id,
        company_name=company.name,
        period=period,
        methodology=methodology,
        rf_prediction=rf_prediction,
        lr_prediction=lr_prediction,
    )


# Assessment-level detail and delete (both models together)


@router.get(
    "/assessment/{ratio_feature_id}",
    response_model=AssessmentResponse,
    summary="Get full dual-model assessment detail for a financial record",
)
def get_assessment(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Retrieve the combined assessment for a ratio_feature_id, enforcing ownership."""
    # Ownership check
    rf_row = (
        db.query(
            RatioFeature,
            Company.id.label("company_id"),
            Company.name.label("company_name"),
            FinancialRecord.period.label("period"),
        )
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            RatioFeature.id == ratio_feature_id,
            Company.owner_id == current_user.id,
        )
        .first()
    )
    if not rf_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    ratio_feature, company_id, company_name, period = rf_row

    predictions = (
        db.query(Prediction)
        .filter(Prediction.ratio_feature_id == ratio_feature_id)
        .options(
            joinedload(Prediction.ratio_feature).joinedload(
                RatioFeature.financial_record
            ),
            joinedload(Prediction.narrative),
        )
        .all()
    )
    if not predictions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No predictions found for this assessment.",
        )

    pred_by_model = {p.model_used: p for p in predictions}
    rf_pred = pred_by_model.get("random_forest")
    lr_pred = pred_by_model.get("logistic_regression")

    methodology = (
        rf_pred.assessment_methodology
        if rf_pred
        else lr_pred.assessment_methodology
    )

    return _build_assessment_response(
        ratio_feature_id=ratio_feature_id,
        company_id=company_id,
        company_name=company_name,
        period=period,
        methodology=methodology,
        rf_prediction=rf_pred,
        lr_prediction=lr_pred,
    )


@router.delete(
    "/assessment/{ratio_feature_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete all model predictions for an assessment (both models)",
)
def delete_assessment(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Delete all Prediction rows for a ratio_feature_id after ownership verification."""
    # Ownership check
    rf_exists = (
        db.query(RatioFeature.id)
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            RatioFeature.id == ratio_feature_id,
            Company.owner_id == current_user.id,
        )
        .first()
    )
    if not rf_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    predictions = (
        db.query(Prediction)
        .filter(Prediction.ratio_feature_id == ratio_feature_id)
        .all()
    )
    if not predictions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No predictions found for this assessment.",
        )

    count = len(predictions)
    for pred in predictions:
        db.delete(pred)
    db.commit()
    logger.info(
        "Assessment deleted: ratio_feature_id=%d rows=%d user_id=%d",
        ratio_feature_id,
        count,
        current_user.id,
    )


# Single-model summary (unchanged)


@router.get(
    "/{prediction_id}/summary",
    summary="Get a direct first-person summary of the prediction result",
)
async def get_prediction_summary(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Generate a short, direct 'What does this mean for me?' interpretation."""
    prediction = (
        db.query(Prediction)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            Prediction.id == prediction_id,
            Company.owner_id == current_user.id,
        )
        .options(joinedload(Prediction.ratio_feature))
        .first()
    )
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found."
        )

    _ratio_feature_to_dict(prediction.ratio_feature)
    shap_values = json.loads(prediction.shap_values_json)

    # Selection of top driver
    top_driver = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[0]

    from app.services.nlp_service import generate_chat_response

    system_prompt = f"""You are a direct and supportive business mentor.
    The user's business has a {prediction.risk_label} status (Probability: {prediction.distress_probability:.1%}).
    The main driver is {top_driver[0]} which is {"increasing" if top_driver[1] > 0 else "reducing"} their risk.
    Translate this result into a single, direct, first-person paragraph (max 60 words).
    Use plain language and a Zambian context.
    Example: 'Based on what you told us, your business is currently under financial pressure. The main reason is that your cash on hand is too low relative to what you owe in the short term.'
    """

    message = "What does this prediction mean for me and my business right now?"

    content, source = await generate_chat_response(system_prompt, [], message)
    return {"summary": content, "source": source}


# Single-model detail (unchanged)


@router.get(
    "/{prediction_id}",
    response_model=PredictionResponse,
    summary="Get full prediction detail with SHAP values and NLP narrative",
)
def get_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Retrieve full prediction object including joined ratio features and narrative."""
    prediction = (
        db.query(Prediction)
        .options(
            joinedload(Prediction.ratio_feature).joinedload(
                RatioFeature.financial_record
            ),
            joinedload(Prediction.narrative),
        )
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
    return _build_prediction_response(prediction)


# Single-model delete (unchanged)


@router.delete(
    "/{prediction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a prediction and its associated narrative and report",
)
def delete_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Delete prediction and associated data after ownership verification."""
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
