"""
FinWatch Zambia - SME Report Service

Generates PDF, CSV, and ZIP bundle exports for completed predictions.
Includes financial ratio analysis, SHAP attributions, and NLP narratives.

Modern Design:
- High-contrast typography (Helvetica-Bold 22pt titles).
- Minimalist tables with zebra striping and subtle light-gray borders.
- Center-aligned executive summary blocks with rounded corners.
- Localised timestamp in branded header (far right).
"""

from __future__ import annotations

import csv
import gc
import io
import json
import logging
import os
import re
import tempfile
import zipfile
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    CondPageBreak,
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.prediction import Prediction

logger = logging.getLogger(__name__)

# --- Configuration & Styling ---

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm

# Modern Colour Palette
PURPLE = colors.HexColor("#6d28d9")
PURPLE_LIGHT = colors.HexColor("#f5f3ff")
GREY_DARK = colors.HexColor("#111827")
GREY_MID = colors.HexColor("#6b7280")
GREY_LIGHT = colors.HexColor("#f9fafb")
BORDER = colors.HexColor("#f3f4f6")
RED = colors.HexColor("#dc2626")
RED_LIGHT = colors.HexColor("#fef2f2")
GREEN = colors.HexColor("#16a34a")
GREEN_LIGHT = colors.HexColor("#f0fdf4")

RATIO_META = {
    "current_ratio": {
        "label": "Current Ratio",
        "unit": "x",
        "dir": "min",
        "bench": 1.5,
    },
    "quick_ratio": {"label": "Quick Ratio", "unit": "x", "dir": "min", "bench": 1.0},
    "cash_ratio": {"label": "Cash Ratio", "unit": "x", "dir": "min", "bench": 0.2},
    "debt_to_equity": {
        "label": "Debt to Equity",
        "unit": "x",
        "dir": "max",
        "bench": 2.0,
    },
    "debt_to_assets": {
        "label": "Debt to Assets",
        "unit": "x",
        "dir": "max",
        "bench": 0.6,
    },
    "interest_coverage": {
        "label": "Interest Coverage",
        "unit": "x",
        "dir": "min",
        "bench": 2.0,
    },
    "net_profit_margin": {
        "label": "Net Profit Margin",
        "unit": "%",
        "dir": "min",
        "bench": 0.05,
    },
    "return_on_assets": {
        "label": "Return on Assets",
        "unit": "%",
        "dir": "min",
        "bench": 0.02,
    },
    "return_on_equity": {
        "label": "Return on Equity",
        "unit": "%",
        "dir": "min",
        "bench": 0.05,
    },
    "asset_turnover": {
        "label": "Asset Turnover",
        "unit": "x",
        "dir": "min",
        "bench": 0.5,
    },
}


def _build_styles() -> dict:
    """Create styles for modern PDF typography."""
    return {
        "title": ParagraphStyle(
            "FWTitle",
            fontSize=22,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            leading=28,
            spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "FWSection",
            fontSize=12,
            fontName="Helvetica-Bold",
            textColor=PURPLE,
            spaceBefore=18,
            spaceAfter=8,
            textTransform="uppercase",
        ),
        "h2": ParagraphStyle(
            "FWH2",
            fontSize=11,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "FWH3",
            fontSize=10,
            fontName="Helvetica-Bold",
            textColor=GREY_DARK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "FWBody",
            fontSize=9.5,
            fontName="Helvetica",
            textColor=GREY_DARK,
            leading=15,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "FWSmall",
            fontSize=8,
            fontName="Helvetica",
            textColor=GREY_MID,
            leading=11,
        ),
        "disclaimer": ParagraphStyle(
            "FWDisclaimer",
            fontSize=7.5,
            fontName="Helvetica-Oblique",
            textColor=GREY_MID,
            leading=12,
        ),
    }


# --- Helpers ---


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "_", slug)
    return slug[:40]


def _fmt_ratio(value: float, unit: str) -> str:
    return f"{value * 100:.1f}%" if unit == "%" else f"{value:.3f}x"


def _fmt_bench(bench: float, unit: str) -> str:
    return f"{bench * 100:.1f}%" if unit == "%" else f"{bench:.2f}x"


def _ratio_ok(value: float, meta: dict) -> bool:
    return value >= meta["bench"] if meta["dir"] == "min" else value <= meta["bench"]


def _resolve_context(prediction: Prediction, db: Session) -> dict:
    from app.models.company import Company
    from app.models.financial_record import FinancialRecord
    from app.models.ratio_feature import RatioFeature

    row = (
        db.query(Company.name, FinancialRecord.period)
        .join(FinancialRecord)
        .join(RatioFeature)
        .filter(RatioFeature.id == prediction.ratio_feature_id)
        .first()
    )
    return {
        "company_name": row[0] if row else "Unknown",
        "period": row[1] if row else "Unknown",
    }


def _get_shap(prediction: Prediction) -> dict[str, float]:
    try:
        return (
            json.loads(prediction.shap_values_json)
            if prediction.shap_values_json
            else {}
        )
    except Exception:
        return {}


# --- PDF Composition ---


def _header_footer(canvas, doc, user_time: str | None = None):
    """Draw the branded header with centered logo and localised timestamp."""
    canvas.saveState()
    w, h = A4

    # Baseline for header content
    header_y = h - 4.5 * cm

    # Centered logo rendered above the separator line
    logo_path = settings.brand_logo_absolute_path
    LOGO_W = 4.2 * cm
    LOGO_H = 1.4 * cm  # Explicit height preserves the ~3:1 landscape aspect ratio
    if logo_path.exists():
        canvas.drawImage(
            str(logo_path),
            (w - LOGO_W) / 2,
            h - 3.2 * cm,
            width=LOGO_W,
            height=LOGO_H,
            preserveAspectRatio=True,
            mask="auto",
        )

    canvas.setStrokeColor(PURPLE)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, header_y, w - MARGIN, header_y)

    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(PURPLE)
    canvas.drawString(MARGIN, header_y + 2 * mm, "FinWatch Zambia")

    if user_time:
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY_MID)
        canvas.drawRightString(w - MARGIN, header_y + 2 * mm, f"Generated: {user_time}")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(
        w / 2,
        MARGIN - 10 * mm,
        f"Page {doc.page}  ·  Institutional Financial Assessment",
    )
    canvas.restoreState()


def generate_pdf_report(
    prediction: Prediction, db: Session, user_time: str | None = None
) -> tuple[str, str]:
    """Build and save the full SME assessment PDF. Returns (file_path, filename)."""
    company_name = prediction.ratio_feature.financial_record.company.name
    period = prediction.ratio_feature.financial_record.period

    filename = f"finwatch_{_slugify(company_name)}_{period}_{prediction.id}.pdf"
    output_path = settings.reports_path / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    styles = _build_styles()
    story = []

    # 1. Title & Assessment Metadata
    title = "Financial Distress Assessment Report"
    if getattr(prediction, "assessment_methodology", "full") == "indicative":
        title = "Indicative Financial Health Report"

    story.append(Paragraph(title, styles["title"]))

    # Metadata block (Accurate Company & Period)
    meta_style = ParagraphStyle(
        "MetaStyle", parent=styles["body"], fontSize=10, leading=14
    )
    story.append(Paragraph(f"<b>Company:</b> {company_name}", meta_style))
    story.append(Paragraph(f"<b>Period:</b> {period}", meta_style))

    story.append(Spacer(1, 0.6 * cm))  # Ample but controlled space
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.5 * cm))

    # 2. Executive Summary (Modern Box - Centered)
    is_distressed = prediction.risk_label == "Distressed"
    risk_color_hex, risk_bg = (
        ("#dc2626", RED_LIGHT) if is_distressed else ("#16a34a", GREEN_LIGHT)
    )
    centered_body = ParagraphStyle("center", parent=styles["body"], alignment=1)

    summary_data = [
        ["Risk Classification", "Distress Probability", "Model Used"],
        [
            Paragraph(
                f'<b><font color="{risk_color_hex}" size="12">{prediction.risk_label.upper()}</font></b>',
                centered_body,
            ),
            Paragraph(
                f"<b><font size='12'>{round(prediction.distress_probability * 100, 1)}%</font></b>",
                centered_body,
            ),
            Paragraph(prediction.model_used.replace("_", " ").title(), centered_body),
        ],
    ]
    st = Table(summary_data, colWidths=[(PAGE_W - 2 * MARGIN) / 3] * 3)
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE_LIGHT),
                ("BACKGROUND", (0, 1), (-1, 1), risk_bg),
                ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.white),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),  # Subtle light gray border
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]
        )
    )
    story.append(st)
    story.append(Spacer(1, 1 * cm))

    # 3. Ratios (Zebra Striped with Subtle Borders)
    story.append(Paragraph("Financial Ratio Analysis", styles["section"]))
    ratio_rows = [["Ratio", "Actual", "Benchmark", "Status"]]
    rf = prediction.ratio_feature
    for k, m in RATIO_META.items():
        v = getattr(rf, k, 0.0)
        ok = _ratio_ok(v, m)
        status_color, status_text = ("#16a34a", "PASS") if ok else ("#dc2626", "FAIL")

        # Benchmark with direction symbol
        symbol = ">= " if m["dir"] == "min" else "<= "
        bench_text = f"{symbol}{_fmt_bench(m['bench'], m['unit'])}"

        ratio_rows.append(
            [
                m["label"],
                Paragraph(f"<b>{_fmt_ratio(v, m['unit'])}</b>", styles["body"]),
                bench_text,
                Paragraph(
                    f'<b><font color="{status_color}">{status_text}</font></b>',
                    styles["body"],
                ),
            ]
        )

    rt = Table(
        ratio_rows,
        colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.4, 0.2, 0.2, 0.2]],
    )
    rt.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE_LIGHT),
                ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("LINEBELOW", (0, 0), (-1, 0), 1.5, PURPLE),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(rt)
    story.append(CondPageBreak(7 * cm))

    # 4. KEY RISK DRIVERS (Modern 4-Column Layout)
    story.append(Paragraph("KEY RISK DRIVERS", styles["section"]))
    shap = _get_shap(prediction)
    if shap:
        sorted_shap = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
        shap_rows = [["Feature", "Influence", "SHAP Value", "Interpretation"]]
        for feat, val in sorted_shap:
            label = RATIO_META.get(feat, {}).get("label", feat)
            inc = val > 0
            dir_text, dir_color = (
                ("Increases Risk", "#dc2626") if inc else ("Reduces Risk", "#16a34a")
            )
            interp = (
                "Contributes toward a distressed classification"
                if inc
                else "Supports an overall healthy risk classification"
            )

            shap_rows.append(
                [
                    label,
                    Paragraph(
                        f'<b><font color="{dir_color}">{dir_text}</font></b>',
                        styles["body"],
                    ),
                    f"{val:+.4f}",
                    Paragraph(interp, styles["small"]),
                ]
            )

        sh_t = Table(
            shap_rows,
            colWidths=[(PAGE_W - 2 * MARGIN) * w for w in [0.28, 0.22, 0.15, 0.35]],
        )
        sh_t.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("BACKGROUND", (0, 0), (-1, 0), PURPLE_LIGHT),
                    ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_LIGHT]),
                    ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LINEBELOW", (0, 0), (-1, 0), 1.5, PURPLE),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(sh_t)
    story.append(Spacer(1, 1 * cm))

    # 5. Narrative
    story.append(Paragraph("Strategic Advisory Narrative", styles["section"]))

    from app.services.markdown_renderer import markdown_to_flowables

    narrative_flowables = markdown_to_flowables(prediction.narrative.content, styles)
    story.extend(narrative_flowables)

    story.append(Spacer(1, 1.5 * cm))

    # 6. Disclaimer
    story.append(Spacer(1, 1.0 * cm))
    disclaimer = "<b>ADVISORY DISCLAIMER:</b> Automated ML system assessment for academic research. Not official financial advice."
    story.append(Paragraph(disclaimer, styles["disclaimer"]))

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=5.5 * cm,
        bottomMargin=MARGIN + 0.5 * cm,
    )
    doc.build(
        story,
        onFirstPage=lambda c, d: _header_footer(c, d, user_time),
        onLaterPages=lambda c, d: _header_footer(c, d, user_time),
    )
    del story
    del doc
    gc.collect()
    return str(output_path), filename


def generate_csv_report(prediction: Prediction, db: Session) -> tuple[bytes, str]:
    """Generate a structured CSV export of the assessment data."""
    ctx = _resolve_context(prediction, db)
    company_name, period = ctx["company_name"], ctx["period"]
    slug = _slugify(company_name)
    filename = f"finwatch_{slug}_{period}_{prediction.id}.csv"

    output = io.StringIO()
    writer = csv.writer(output)

    # Title Row
    writer.writerow([f"FINWATCH ASSESSMENT: {company_name} ({period})"])
    writer.writerow([])

    writer.writerow(["# SECTION 1: ASSESSMENT METADATA"])
    writer.writerow(["Field", "Value"])
    writer.writerow(["Company", company_name])
    writer.writerow(["Reporting Period", period])
    writer.writerow(["Risk Classification", prediction.risk_label])
    writer.writerow(
        ["Distress Probability", f"{prediction.distress_probability * 100:.2f}%"]
    )
    writer.writerow(["ML Model", prediction.model_used.replace("_", " ").title()])
    writer.writerow([])

    writer.writerow(["# SECTION 2: FINANCIAL RATIOS"])
    writer.writerow(["Ratio", "Actual Value", "Healthy Benchmark", "Status"])
    rf = prediction.ratio_feature
    for k, m in RATIO_META.items():
        v = getattr(rf, k, 0.0)
        ok = _ratio_ok(v, m)
        symbol = ">= " if m["dir"] == "min" else "<= "
        writer.writerow(
            [m["label"], f"{v:.4f}", f"{symbol}{m['bench']}", "PASS" if ok else "FAIL"]
        )
    writer.writerow([])

    writer.writerow(["# SECTION 3: KEY RISK DRIVERS (SHAP)"])
    writer.writerow(["Feature", "SHAP Value", "Influence", "Interpretation"])
    shap = _get_shap(prediction)
    if shap:
        sorted_shap = sorted(shap.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
        for feat, val in sorted_shap:
            label = RATIO_META.get(feat, {}).get("label", feat)
            inc = val > 0
            writer.writerow(
                [
                    label,
                    f"{val:+.6f}",
                    "Increases Risk" if inc else "Reduces Risk",
                    "Contributes toward distress" if inc else "Supports healthy status",
                ]
            )
    else:
        writer.writerow(["SHAP values not available", "", "", ""])

    return output.getvalue().encode("utf-8-sig"), filename


def generate_zip_bundle(prediction: Prediction, db: Session) -> tuple[str, str]:
    """Generate a ZIP bundle (PDF + CSV) for a prediction.

    Writes the ZIP directly to a temporary file to prevent high memory usage.
    """
    pdf_path, pdf_name = generate_pdf_report(prediction, db)
    csv_bytes, csv_name = generate_csv_report(prediction, db)

    tmp_file = tempfile.NamedTemporaryFile(
        delete=False, suffix=".zip", dir=settings.reports_path
    )
    tmp_path = tmp_file.name
    tmp_file.close()

    with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        # Read PDF directly from disk — avoids duplicate in-memory copy
        if os.path.exists(pdf_path):
            zf.write(pdf_path, pdf_name)
        else:
            zf.writestr(pdf_name, b"")
        zf.writestr(csv_name, csv_bytes)

    return tmp_path, f"finwatch_bundle_{prediction.id}.zip"
