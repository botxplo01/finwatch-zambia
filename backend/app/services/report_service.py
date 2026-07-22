"""
FinWatch Zambia - SME Report Service

Generates PDF, CSV, and ZIP assessment export packages for predictions.
Includes ratio analysis, SHAP feature attributions, and AI financial narratives.
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
import unicodedata
import zipfile
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
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
from app.services.markdown_renderer import markdown_to_flowables

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.prediction import Prediction

logger = logging.getLogger(__name__)

_GEIST_FONT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "fonts"
)
_GEIST_MAP = {
    "Geist": "Geist-Regular.ttf",
    "Geist-Bold": "Geist-Bold.ttf",
    "Geist-Italic": "Geist-Italic.ttf",
    "Geist-BoldItalic": "Geist-BoldItalic.ttf",
    "GeistMono": "GeistMono-Regular.ttf",
    "GeistMono-Bold": "GeistMono-Bold.ttf",
}
_FONTS_REGISTERED = False

def _register_geist() -> bool:
    """Register Geist TTF variants from the frontend node_modules. Returns True on success."""
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return True
    try:
        for name, filename in _GEIST_MAP.items():
            path = os.path.join(_GEIST_FONT_DIR, filename)
            pdfmetrics.registerFont(TTFont(name, path))
        pdfmetrics.registerFontFamily(
            "Geist",
            normal="Geist",
            bold="Geist-Bold",
            italic="Geist-Italic",
            boldItalic="Geist-BoldItalic",
        )
        pdfmetrics.registerFontFamily(
            "GeistMono",
            normal="GeistMono",
            bold="GeistMono-Bold",
        )
        _FONTS_REGISTERED = True
        return True
    except Exception as exc:
        logger.warning("Geist registration failed, falling back to Helvetica: %s", exc)
        return False

_USE_GEIST = _register_geist()
_FONT = "Geist" if _USE_GEIST else "Helvetica"
_FONT_BOLD = "Geist-Bold" if _USE_GEIST else "Helvetica-Bold"
_FONT_ITALIC = "Geist-Italic" if _USE_GEIST else "Helvetica-Oblique"
_FONT_MONO = "GeistMono" if _USE_GEIST else "Courier"

PAGE_W, PAGE_H = A4
MARGIN = 1.8 * cm

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
            fontName=_FONT_BOLD,
            textColor=GREY_DARK,
            leading=28,
            spaceAfter=14,
        ),
        "section": ParagraphStyle(
            "FWSection",
            fontSize=12,
            fontName=_FONT_BOLD,
            textColor=PURPLE,
            spaceBefore=18,
            spaceAfter=8,
            textTransform="uppercase",
        ),
        "h2": ParagraphStyle(
            "FWH2",
            fontSize=11,
            fontName=_FONT_BOLD,
            textColor=GREY_DARK,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "FWH3",
            fontSize=10,
            fontName=_FONT_BOLD,
            textColor=GREY_DARK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "FWBody",
            fontSize=9.5,
            fontName=_FONT,
            textColor=GREY_DARK,
            leading=15,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "FWSmall",
            fontSize=8,
            fontName=_FONT,
            textColor=GREY_MID,
            leading=11,
        ),
        "disclaimer": ParagraphStyle(
            "FWDisclaimer",
            fontSize=7.5,
            fontName=_FONT_ITALIC,
            textColor=GREY_MID,
            leading=12,
        ),
    }

def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "_", slug)
    return slug[:40]

def _pdf_safe(text: str) -> str:
    # Sanitize layout inputs: replace non-ASCII characters and typographic markers with standard ASCII glyphs to avoid layout errors and missing font glyphs in PDF engines.
    """Sanitize text for ReportLab PDF output.

    Performs two passes:
    1. Explicit map — common typographic Unicode characters are replaced with
       their closest ASCII equivalents so the intent is preserved.
    2. NFKD catch-all — any remaining non-ASCII character is decomposed and
       re-encoded as ASCII (errors ignored), stripping anything that Geist or
       the Helvetica fallback cannot render without producing a glyph box.
    """

    mapped = (
        text
        .replace("\u2013", "-")    # en-dash
        .replace("\u2014", "-")    # em-dash
        .replace("\u2212", "-")    # minus sign
        .replace("\u2010", "-")    # hyphen
        .replace("\u2011", "-")    # non-breaking hyphen
        .replace("\u2022", "*")    # bullet
        .replace("\u2023", "*")    # triangular bullet
        .replace("\u25cf", "*")    # black circle
        .replace("\u2018", "'")    # left single quotation
        .replace("\u2019", "'")    # right single quotation
        .replace("\u201a", "'")    # single low-9 quotation
        .replace("\u201c", '"')    # left double quotation
        .replace("\u201d", '"')    # right double quotation
        .replace("\u201e", '"')    # double low-9 quotation
        .replace("\u2026", "...")  # horizontal ellipsis
        .replace("\u00b7", "-")    # middle dot
        .replace("\u00d7", "x")    # multiplication sign
        .replace("\u00f7", "/")    # division sign
        .replace("\u2264", "<=")   # less-than or equal
        .replace("\u2265", ">=")   # greater-than or equal
        .replace("\u00a0", " ")    # non-breaking space
        .replace("\u2002", " ")    # en space
        .replace("\u2003", " ")    # em space
        .replace("\u2192", "->")   # rightward arrow
        .replace("\u2190", "<-")   # leftward arrow
        .replace("\u2191", "^")    # upward arrow
        .replace("\u2193", "v")    # downward arrow
        .replace("\u2713", "ok")   # check mark
        .replace("\u2717", "x")    # ballot x
        .replace("\u00ae", "(R)")  # registered sign
        .replace("\u00a9", "(C)")  # copyright sign
        .replace("\u2122", "(TM)") # trade mark sign
        .replace("\u00bc", "1/4")  # vulgar fraction one quarter
        .replace("\u00bd", "1/2")  # vulgar fraction one half
        .replace("\u00be", "3/4")  # vulgar fraction three quarters
    )

    out: list[str] = []
    for ch in mapped:
        if ord(ch) < 128 or ch in "\n\r\t":
            out.append(ch)
        else:
            decomposed = unicodedata.normalize("NFKD", ch)
            ascii_equiv = decomposed.encode("ascii", errors="ignore").decode("ascii")
            out.append(ascii_equiv)
    return "".join(out)

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

def _header_footer(canvas, doc, user_time: str | None = None):
    """Draw the branded header with centered logo and localised timestamp."""
    canvas.saveState()
    w, h = A4

    header_y = h - 4.5 * cm

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

    canvas.setFont(_FONT_BOLD, 8)
    canvas.setFillColor(PURPLE)
    canvas.drawString(MARGIN, header_y + 2 * mm, "FinWatch Zambia")

    if user_time:
        canvas.setFont(_FONT, 7.5)
        canvas.setFillColor(GREY_MID)
        canvas.drawRightString(w - MARGIN, header_y + 2 * mm, f"Generated: {user_time}")

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 4 * mm, w - MARGIN, MARGIN - 4 * mm)
    canvas.setFont(_FONT, 7.5)
    canvas.setFillColor(GREY_MID)
    canvas.drawCentredString(
        w / 2,
        MARGIN - 10 * mm,
        f"Page {doc.page}  ·  Institutional Financial Assessment",
    )
    canvas.restoreState()

def _resolve_assessment_context(ratio_feature_id: int, db: "Session") -> dict:
    """Return company_name, period, and assessment_methodology for a ratio_feature_id.

    Resolves via explicit RatioFeature → FinancialRecord → Company join chain.
    """
    from app.models.company import Company
    from app.models.financial_record import FinancialRecord
    from app.models.prediction import Prediction
    from app.models.ratio_feature import RatioFeature

    row = (
        db.query(Company.name, FinancialRecord.period)
        .select_from(RatioFeature)
        .join(FinancialRecord, RatioFeature.financial_record_id == FinancialRecord.id)
        .join(Company, FinancialRecord.company_id == Company.id)
        .filter(RatioFeature.id == ratio_feature_id)
        .first()
    )
    methodology_row = (
        db.query(Prediction.assessment_methodology)
        .filter(Prediction.ratio_feature_id == ratio_feature_id)
        .first()
    )
    return {
        "company_name": row[0] if row else "Unknown",
        "period": row[1] if row else "Unknown",
        "assessment_methodology": methodology_row[0] if methodology_row else "full",
    }

def _build_model_summary_block(
    prediction: "Prediction | None", model_label: str, styles: dict
) -> list:
    """Return a list of ReportLab flowables for one model's result block.

    If prediction is None, returns a single notice flowable. If prediction
    exists but narrative is absent, renders a placeholder rather than failing.
    """
    flowables: list = []
    flowables.append(CondPageBreak(7 * cm))
    flowables.append(Paragraph(model_label, styles["section"]))

    if prediction is None:
        flowables.append(
            Paragraph(
                f"{model_label} did not complete for this assessment.",
                styles["body"],
            )
        )
        return flowables

    is_distressed = prediction.risk_label == "Distressed"
    risk_color_hex, risk_bg = (
        ("#dc2626", RED_LIGHT) if is_distressed else ("#16a34a", GREEN_LIGHT)
    )
    centered_body = ParagraphStyle("center_ms", parent=styles["body"], alignment=1)

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
                ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.white),
                ("GRID", (0, 0), (-1, -1), 0.3, BORDER),
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]
        )
    )
    flowables.append(st)
    flowables.append(Spacer(1, 0.6 * cm))

    flowables.append(Paragraph("Key Risk Drivers (SHAP)", styles["h2"]))
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
                    ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
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
        flowables.append(sh_t)
    else:
        flowables.append(
            Paragraph(
                "SHAP attribution data not available for this model.", styles["small"]
            )
        )

    flowables.append(Spacer(1, 0.8 * cm))

    flowables.append(Paragraph("Strategic Advisory Narrative", styles["h2"]))
    if prediction.narrative:
        narrative_flowables = markdown_to_flowables(
            _pdf_safe(prediction.narrative.content), styles
        )
        flowables.extend(narrative_flowables)
    else:
        flowables.append(
            Paragraph("Narrative unavailable for this model.", styles["body"])
        )

    flowables.append(Spacer(1, 1 * cm))
    return flowables

def generate_assessment_pdf_report(
    rf_prediction: "Prediction | None",
    lr_prediction: "Prediction | None",
    ratio_feature_id: int,
    db: "Session",
    user_time: str | None = None,
) -> tuple[str, str]:
    """Build and save a combined dual-model PDF for one assessment.

    Financial Ratio Analysis is rendered once (ratios are shared). Per-model
    sections (summary, SHAP, narrative) are rendered twice — RF first, LR second.
    Returns (file_path, filename).
    """
    anchor = rf_prediction if rf_prediction is not None else lr_prediction
    company_name = anchor.ratio_feature.financial_record.company.name
    period = anchor.ratio_feature.financial_record.period
    methodology = getattr(anchor, "assessment_methodology", "full") or "full"

    slug = _slugify(company_name)
    filename = f"finwatch_{slug}_{period}_assessment_{ratio_feature_id}.pdf"
    output_path = settings.reports_path / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    styles = _build_styles()
    story: list = []

    title = (
        "Indicative Financial Health Report"
        if methodology == "indicative"
        else "Financial Distress Assessment Report"
    )
    meta_style = ParagraphStyle(
        "MetaStyle", parent=styles["body"], fontSize=10, leading=14
    )
    story.append(Paragraph(title, styles["title"]))
    story.append(Paragraph(f"<b>Company:</b> {company_name}", meta_style))
    story.append(Paragraph(f"<b>Period:</b> {period}", meta_style))
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Financial Ratio Analysis", styles["section"]))
    rf = anchor.ratio_feature
    ratio_rows = [["Ratio", "Actual", "Benchmark", "Status"]]
    for k, m in RATIO_META.items():
        v = getattr(rf, k, 0.0)
        ok = _ratio_ok(v, m)
        status_color, status_text = ("#16a34a", "PASS") if ok else ("#dc2626", "FAIL")
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
                ("FONTNAME", (0, 0), (-1, 0), _FONT_BOLD),
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
    story.append(Spacer(1, 0.6 * cm))

    if (
        rf_prediction is not None
        and lr_prediction is not None
        and rf_prediction.risk_label != lr_prediction.risk_label
    ):
        AMBER = colors.HexColor("#b45309")
        AMBER_LIGHT = colors.HexColor("#fffbeb")
        AMBER_BORDER = colors.HexColor("#fcd34d")
        disagreement_text = (
            f"<b>Model Disagreement:</b> Random Forest classifies this assessment as "
            f"<b>{rf_prediction.risk_label}</b>; Logistic Regression classifies it as "
            f"<b>{lr_prediction.risk_label}</b>. "
            "Review both analyses below before drawing conclusions."
        )
        notice_data = [
            [
                Paragraph(
                    disagreement_text,
                    ParagraphStyle(
                        "DisagreeBody", parent=styles["body"], textColor=AMBER
                    ),
                )
            ]
        ]
        notice_t = Table(notice_data, colWidths=[PAGE_W - 2 * MARGIN])
        notice_t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), AMBER_LIGHT),
                    ("BOX", (0, 0), (-1, -1), 1.0, AMBER_BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("ROUNDEDCORNERS", [6, 6, 6, 6]),
                ]
            )
        )
        story.append(notice_t)
        story.append(Spacer(1, 0.6 * cm))

    story.extend(
        _build_model_summary_block(
            rf_prediction, "Random Forest (Primary Model)", styles
        )
    )
    story.extend(
        _build_model_summary_block(
            lr_prediction, "Logistic Regression (Secondary Model)", styles
        )
    )

    story.append(Spacer(1, 1.0 * cm))
    disclaimer = (
        "<b>ADVISORY DISCLAIMER:</b> Automated ML system assessment for academic research. "
        "Not official financial advice."
    )
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

def generate_assessment_csv_report(
    rf_prediction: "Prediction | None",
    lr_prediction: "Prediction | None",
    ratio_feature_id: int,
    db: "Session",
) -> tuple[bytes, str]:
    """Generate a structured CSV covering both models for one assessment.

    Financial ratios appear once (Section 2). SHAP values are split into
    Section 3a (RF) and Section 3b (LR). Narrative text is omitted — CSV is
    strictly tabular; the PDF is the canonical narrative artifact.
    """
    anchor = rf_prediction if rf_prediction is not None else lr_prediction
    company_name = anchor.ratio_feature.financial_record.company.name
    period = anchor.ratio_feature.financial_record.period
    slug = _slugify(company_name)
    filename = f"finwatch_{slug}_{period}_assessment_{ratio_feature_id}.csv"

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([f"FINWATCH DUAL-MODEL ASSESSMENT: {company_name} ({period})"])
    writer.writerow([])

    writer.writerow(["# SECTION 1: ASSESSMENT METADATA"])
    writer.writerow(["Field", "Value"])
    writer.writerow(["Company", company_name])
    writer.writerow(["Reporting Period", period])

    if rf_prediction is not None:
        writer.writerow(
            ["Random Forest — Risk Classification", rf_prediction.risk_label]
        )
        writer.writerow(
            [
                "Random Forest — Distress Probability",
                f"{rf_prediction.distress_probability * 100:.2f}%",
            ]
        )
    else:
        writer.writerow(["Random Forest", "N/A — model did not complete"])

    if lr_prediction is not None:
        writer.writerow(
            ["Logistic Regression — Risk Classification", lr_prediction.risk_label]
        )
        writer.writerow(
            [
                "Logistic Regression — Distress Probability",
                f"{lr_prediction.distress_probability * 100:.2f}%",
            ]
        )
    else:
        writer.writerow(["Logistic Regression", "N/A — model did not complete"])

    if rf_prediction is not None and lr_prediction is not None:
        if rf_prediction.risk_label == lr_prediction.risk_label:
            agreement_val = "Yes"
        else:
            agreement_val = (
                f"No — RF: {rf_prediction.risk_label}, LR: {lr_prediction.risk_label}"
            )
    else:
        agreement_val = "N/A"
    writer.writerow(["Models Agreement", agreement_val])
    writer.writerow([])

    writer.writerow(["# SECTION 2: FINANCIAL RATIOS"])
    writer.writerow(["Ratio", "Actual Value", "Healthy Benchmark", "Status"])
    rf = anchor.ratio_feature
    for k, m in RATIO_META.items():
        v = getattr(rf, k, 0.0)
        ok = _ratio_ok(v, m)
        symbol = ">= " if m["dir"] == "min" else "<= "
        writer.writerow(
            [m["label"], f"{v:.4f}", f"{symbol}{m['bench']}", "PASS" if ok else "FAIL"]
        )
    writer.writerow([])

    writer.writerow(["# SECTION 3A: RANDOM FOREST — KEY RISK DRIVERS (SHAP)"])
    writer.writerow(["Feature", "SHAP Value", "Influence", "Interpretation"])
    if rf_prediction is not None:
        shap_rf = _get_shap(rf_prediction)
        if shap_rf:
            for feat, val in sorted(
                shap_rf.items(), key=lambda x: abs(x[1]), reverse=True
            )[:5]:
                label = RATIO_META.get(feat, {}).get("label", feat)
                inc = val > 0
                writer.writerow(
                    [
                        label,
                        f"{val:+.6f}",
                        "Increases Risk" if inc else "Reduces Risk",
                        (
                            "Contributes toward distress"
                            if inc
                            else "Supports healthy status"
                        ),
                    ]
                )
        else:
            writer.writerow(["SHAP values not available", "", "", ""])
    else:
        writer.writerow(
            ["Random Forest did not complete for this assessment", "", "", ""]
        )
    writer.writerow([])

    writer.writerow(["# SECTION 3B: LOGISTIC REGRESSION — KEY RISK DRIVERS (SHAP)"])
    writer.writerow(["Feature", "SHAP Value", "Influence", "Interpretation"])
    if lr_prediction is not None:
        shap_lr = _get_shap(lr_prediction)
        if shap_lr:
            for feat, val in sorted(
                shap_lr.items(), key=lambda x: abs(x[1]), reverse=True
            )[:5]:
                label = RATIO_META.get(feat, {}).get("label", feat)
                inc = val > 0
                writer.writerow(
                    [
                        label,
                        f"{val:+.6f}",
                        "Increases Risk" if inc else "Reduces Risk",
                        (
                            "Contributes toward distress"
                            if inc
                            else "Supports healthy status"
                        ),
                    ]
                )
        else:
            writer.writerow(["SHAP values not available", "", "", ""])
    else:
        writer.writerow(
            ["Logistic Regression did not complete for this assessment", "", "", ""]
        )

    return output.getvalue().encode("utf-8-sig"), filename

def generate_assessment_zip_bundle(
    rf_prediction: "Prediction | None",
    lr_prediction: "Prediction | None",
    ratio_feature_id: int,
    db: "Session",
) -> tuple[str, str]:
    """Generate a ZIP bundle (PDF + CSV) for a dual-model assessment.

    Writes the ZIP directly to a temporary file to prevent high memory usage.
    """
    pdf_path, pdf_name = generate_assessment_pdf_report(
        rf_prediction, lr_prediction, ratio_feature_id, db
    )
    csv_bytes, csv_name = generate_assessment_csv_report(
        rf_prediction, lr_prediction, ratio_feature_id, db
    )

    tmp_file = tempfile.NamedTemporaryFile(
        delete=False, suffix=".zip", dir=settings.reports_path
    )
    tmp_path = tmp_file.name
    tmp_file.close()

    with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(pdf_path):
            zf.write(pdf_path, pdf_name)
        else:
            zf.writestr(pdf_name, b"")
        zf.writestr(csv_name, csv_bytes)

    return tmp_path, f"finwatch_bundle_assessment_{ratio_feature_id}.zip"
