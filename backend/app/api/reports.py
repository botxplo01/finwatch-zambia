"""
FinWatch Zambia - Reports Router (SME Portal)

Endpoints:
- GET  /api/reports/                              - List all generated PDF reports for the current user
- DELETE /api/reports/{report_id}                 - Clear a report history entry
- POST /api/reports/assessment/{ratio_feature_id} - Generate and save a dual-model PDF assessment report
- GET  /api/reports/assessment/{ratio_feature_id} - Download the saved PDF for an assessment
- GET  /api/reports/assessment/{ratio_feature_id}/csv - Generate and stream a dual-model CSV export
- GET  /api/reports/assessment/{ratio_feature_id}/zip - Generate and stream a dual-model ZIP bundle
"""

import logging
import os
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_current_sme_user, get_db
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.report import Report
from app.models.user import User
from app.services.report_service import (
    _slugify,
    generate_assessment_csv_report,
    generate_assessment_pdf_report,
    generate_assessment_zip_bundle,
)

logger = logging.getLogger(__name__)
router = APIRouter()



def _get_owned_assessment(
    ratio_feature_id: int, user: User, db: Session
) -> tuple["Prediction | None", "Prediction | None"]:
    """Verify ownership for a ratio_feature_id and fetch both model Prediction rows.

    Returns (rf_prediction, lr_prediction). Raises 404 if ownership fails or
    neither prediction exists. One of the two may be None for partial completions.
    """
    owns = (
        db.query(RatioFeature.id)
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(
            RatioFeature.id == ratio_feature_id,
            Company.owner_id == user.id,
        )
        .first()
    )
    if not owns:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    predictions = (
        db.query(Prediction)
        .filter(Prediction.ratio_feature_id == ratio_feature_id)
        .options(
            joinedload(Prediction.ratio_feature).joinedload(
                RatioFeature.financial_record
            ),
            joinedload(Prediction.narrative),
            joinedload(Prediction.report),
        )
        .all()
    )
    if not predictions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No predictions found for this assessment.",
        )

    by_model = {p.model_used: p for p in predictions}
    return by_model.get("random_forest"), by_model.get("logistic_regression")


def _ensure_assessment_report_record(
    rf_prediction: "Prediction | None",
    lr_prediction: "Prediction | None",
    filename: str,
    file_path: str,
    db: Session,
) -> Report:
    """Ensure a Report record exists for the combined dual-model assessment.

    Anchors to rf_prediction when not None, else lr_prediction, since the
    Report table has a unique FK per prediction row.
    """
    anchor = rf_prediction if rf_prediction is not None else lr_prediction
    if anchor.report:
        anchor.report.filename = filename
        anchor.report.file_path = file_path
        anchor.report.generated_at = datetime.utcnow()
        report = anchor.report
    else:
        report = Report(prediction_id=anchor.id, filename=filename, file_path=file_path)
        db.add(report)

    db.commit()
    db.refresh(report)
    return report


@router.get("/", summary="List all generated PDF reports for the current user")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Return list of all generated PDF reports for the current user."""
    results = (
        db.query(
            Report,
            Company.name.label("company_name"),
            Prediction.ratio_feature_id.label("ratio_feature_id"),
        )
        .join(Prediction, Report.prediction_id == Prediction.id)
        .join(RatioFeature, Prediction.ratio_feature_id == RatioFeature.id)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(Company.owner_id == current_user.id)
        .order_by(Report.generated_at.desc())
        .all()
    )
    return [
        {
            "report_id": report.id,
            "prediction_id": report.prediction_id,
            "ratio_feature_id": ratio_feature_id,
            "company_name": company_name,
            "filename": report.filename,
            "generated_at": report.generated_at.isoformat(),
        }
        for report, company_name, ratio_feature_id in results
    ]


# ---------------------------------------------------------------------------
# Assessment-level (dual-model) report endpoints
# These must be declared before /{prediction_id} routes so FastAPI matches
# the literal 'assessment' path segment before attempting int coercion.
# ---------------------------------------------------------------------------


@router.post(
    "/assessment/{ratio_feature_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Generate and save a combined PDF report for a dual-model assessment",
)
def generate_assessment_report(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
    x_user_time: str | None = Header(default=None),
):
    """Generate and persist a combined dual-model PDF for a ratio_feature_id."""
    rf_prediction, lr_prediction = _get_owned_assessment(
        ratio_feature_id, current_user, db
    )

    try:
        file_path, filename = generate_assessment_pdf_report(
            rf_prediction=rf_prediction,
            lr_prediction=lr_prediction,
            ratio_feature_id=ratio_feature_id,
            db=db,
            user_time=x_user_time,
        )
    except Exception as exc:
        logger.error(
            "Assessment PDF generation failed for ratio_feature_id %d: %s",
            ratio_feature_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {exc}",
        )

    report = _ensure_assessment_report_record(
        rf_prediction, lr_prediction, filename, file_path, db
    )
    logger.info(
        "Assessment PDF report updated/persisted: id=%d ratio_feature_id=%d",
        report.id,
        ratio_feature_id,
    )
    return {
        "detail": "Report generated successfully.",
        "report_id": report.id,
        "filename": report.filename,
        "generated_at": report.generated_at.isoformat(),
    }


@router.get(
    "/assessment/{ratio_feature_id}",
    summary="Download the saved combined PDF report for a dual-model assessment",
)
def download_assessment_report(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
    x_user_time: str | None = Header(default=None),
):
    """Download the saved combined PDF for a ratio_feature_id, regenerating if the file is missing."""
    rf_prediction, lr_prediction = _get_owned_assessment(
        ratio_feature_id, current_user, db
    )
    anchor = rf_prediction if rf_prediction is not None else lr_prediction

    if not anchor.report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PDF report found. Generate one first via POST /api/reports/assessment/{ratio_feature_id}.",
        )

    file_path = anchor.report.file_path
    if not os.path.exists(file_path):
        try:
            new_path, _ = generate_assessment_pdf_report(
                rf_prediction=rf_prediction,
                lr_prediction=lr_prediction,
                ratio_feature_id=ratio_feature_id,
                db=db,
                user_time=x_user_time,
            )
            anchor.report.file_path = new_path
            db.commit()
            file_path = new_path
        except Exception as exc:
            logger.error(
                "Auto-regeneration failed for assessment %d: %s", ratio_feature_id, exc
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Report file missing and regeneration failed.",
            )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=anchor.report.filename,
    )


@router.get(
    "/assessment/{ratio_feature_id}/csv",
    summary="Generate and stream a CSV export for a dual-model assessment",
)
def download_assessment_csv(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Generate and stream a combined CSV export for a ratio_feature_id."""
    rf_prediction, lr_prediction = _get_owned_assessment(
        ratio_feature_id, current_user, db
    )

    try:
        csv_bytes, filename = generate_assessment_csv_report(
            rf_prediction=rf_prediction,
            lr_prediction=lr_prediction,
            ratio_feature_id=ratio_feature_id,
            db=db,
        )
    except Exception as exc:
        logger.error(
            "Assessment CSV generation failed for ratio_feature_id %d: %s",
            ratio_feature_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CSV generation failed: {exc}",
        )

    # Register a Report record so the assessment appears in the reports list.
    # Use the deterministic PDF filename as the canonical reference.
    anchor = rf_prediction if rf_prediction is not None else lr_prediction
    from app.core.config import settings

    pdf_filename = (
        f"finwatch_{_slugify(anchor.ratio_feature.financial_record.company.name)}"
        f"_{anchor.ratio_feature.financial_record.period}"
        f"_assessment_{ratio_feature_id}.pdf"
    )
    pdf_file_path = str(settings.reports_path / pdf_filename)
    _ensure_assessment_report_record(
        rf_prediction, lr_prediction, pdf_filename, pdf_file_path, db
    )

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/assessment/{ratio_feature_id}/zip",
    summary="Generate and stream a ZIP bundle (PDF + CSV) for a dual-model assessment",
)
def download_assessment_zip(
    ratio_feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Generate and stream a ZIP bundle for a dual-model assessment."""
    rf_prediction, lr_prediction = _get_owned_assessment(
        ratio_feature_id, current_user, db
    )

    try:
        tmp_path, filename = generate_assessment_zip_bundle(
            rf_prediction=rf_prediction,
            lr_prediction=lr_prediction,
            ratio_feature_id=ratio_feature_id,
            db=db,
        )
    except Exception as exc:
        logger.error(
            "Assessment ZIP generation failed for ratio_feature_id %d: %s",
            ratio_feature_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ZIP bundle generation failed: {exc}",
        )

    # Ensure assessment appears in the reports list.
    anchor = rf_prediction if rf_prediction is not None else lr_prediction
    from app.core.config import settings

    pdf_filename = (
        f"finwatch_{_slugify(anchor.ratio_feature.financial_record.company.name)}"
        f"_{anchor.ratio_feature.financial_record.period}"
        f"_assessment_{ratio_feature_id}.pdf"
    )
    pdf_file_path = str(settings.reports_path / pdf_filename)
    _ensure_assessment_report_record(
        rf_prediction, lr_prediction, pdf_filename, pdf_file_path, db
    )

    def iter_file():
        try:
            with open(tmp_path, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk
        finally:
            try:
                os.unlink(tmp_path)
            except Exception as exc:
                logger.warning("Failed to delete temp ZIP file %s: %s", tmp_path, exc)

    return StreamingResponse(
        iter_file(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



@router.delete("/{report_id}", summary="Clear a report history entry")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_sme_user),
):
    """Remove a report metadata record and its associated physical file."""
    report = (
        db.query(Report)
        .join(Prediction)
        .join(RatioFeature)
        .join(FinancialRecord)
        .join(Company)
        .filter(Report.id == report_id, Company.owner_id == current_user.id)
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found."
        )

    # Cleanup physical file if it exists
    if os.path.exists(report.file_path):
        try:
            os.remove(report.file_path)
        except Exception as exc:
            logger.warning(
                "Could not delete physical report file %s: %s", report.file_path, exc
            )

    db.delete(report)
    db.commit()
    logger.info("Report entry cleared: id=%d user_id=%d", report_id, current_user.id)
    return {"detail": "Report entry cleared."}


