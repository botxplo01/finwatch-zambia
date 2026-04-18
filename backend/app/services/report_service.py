# =============================================================================
# FinWatch Zambia — Report Service
#
# Generates PDF assessment reports for completed predictions.
# Full implementation in Stage 5 using ReportLab.
#
# Report content (per prediction):
#   - Company name and reporting period
#   - Risk classification badge (Distressed / Healthy)
#   - Distress probability
#   - Financial ratio table with actual values vs healthy benchmarks
#   - SHAP attribution summary (top 5 drivers)
#   - Full NLP-generated financial health narrative
#   - System disclaimer (advisory only — not for credit decisions)
#   - Generation timestamp and model version
#
# File naming convention:
#   finwatch_report_{company_name_slug}_{period}_{prediction_id}.pdf
#
# Storage:
#   Files are written to settings.reports_path (auto-created at startup).
#   The Report ORM model stores filename and file_path for later retrieval.
#   Files are NOT committed to Git — the directory is in .gitignore.
# =============================================================================

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.prediction import Prediction

logger = logging.getLogger(__name__)


def _slugify(text: str) -> str:
    """
    Convert a string to a filesystem-safe slug.
    Replaces spaces and special characters with underscores.
    Used to build safe PDF filenames from company names.
    """
    import re

    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "_", slug)
    return slug[:50]  # Cap at 50 chars to keep filenames reasonable


def generate_pdf_report(
    prediction: "Prediction",
    db: "Session",
) -> tuple[str, str]:
    """
    Generate a PDF assessment report for a completed prediction.

    This is the primary interface called by the reports router.
    Do not change the signature — the router depends on it.

    Args:
        prediction: Fully loaded Prediction ORM object with ratio_feature
                    and narrative relationships eagerly loaded.
        db:         Active SQLAlchemy session (for any additional queries).

    Returns:
        Tuple of (file_path: str, filename: str)
          file_path — absolute path to the generated PDF on disk
          filename  — the PDF filename (used for Content-Disposition header)

    Raises:
        NotImplementedError: Until Stage 5 implements this.
        RuntimeError:        If the prediction is missing required related data.

    Stage 5 implementation outline:
        1. Validate that prediction.narrative and prediction.ratio_feature exist
        2. Resolve company name and period via the ORM join chain
        3. Build filename using _slugify(company_name), period, prediction.id
        4. Construct PDF using ReportLab (platypus for layout):
            - Page header with FinWatch Zambia branding
            - Risk badge section (Distressed/Healthy with probability)
            - Ratio table: name | actual | benchmark | status (✓/✗)
            - SHAP top-5 attribution bar section (rendered as text table)
            - Full narrative text block
            - Footer with disclaimer and generation metadata
        5. Write PDF to settings.reports_path / filename
        6. Return (str(file_path), filename)

    Example ReportLab structure (Stage 5):
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table
        from reportlab.lib.styles import getSampleStyleSheet
        output_path = settings.reports_path / filename
        doc = SimpleDocTemplate(str(output_path), pagesize=A4)
        story = [...]  # build elements
        doc.build(story)
        return str(output_path), filename
    """
    # Pre-Stage 5: validate inputs so the error is clear
    if prediction.ratio_feature is None:
        raise RuntimeError(
            f"Prediction {prediction.id} has no ratio_feature — cannot generate report."
        )
    if prediction.narrative is None:
        raise RuntimeError(
            f"Prediction {prediction.id} has no narrative — "
            "generate the prediction first via POST /api/predictions/."
        )

    raise NotImplementedError(
        "PDF report generation will be implemented in Stage 5 using ReportLab."
    )
