"""
FinWatch Zambia - NLP Narrative + Chat Service

Two public interfaces:
- generate_narrative() - Grounded prediction narrative (predictions router)
- generate_chat_response() - Conversational AI for the SME chat modal

Fallback logic:
- Respects settings.NLP_PRIMARY and settings.NLP_FALLBACK
- Tries Groq Cloud, Ollama Cloud, and Ollama Local in sequence
- Always falls back to the Template Engine as a last resort
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any, Callable

import httpx
from groq import Groq

from app.core.config import settings
from app.services.ratio_engine import RATIO_BENCHMARKS_DISPLAY, RATIO_DISPLAY_NAMES

logger = logging.getLogger(__name__)


def build_narrative_prompt(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    benchmarks: dict[str, str],
    period: str | None = None,
) -> str:
    """Build the prompt for generating a financial health narrative."""
    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now().year:
                is_past = True

    tense_verb = "was" if is_past else "is"
    tense_phrase = "in the assessed period" if is_past else "currently"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
    shap_lines = "\n".join(
        [
            f"  - {name}: {val:+.4f} ({'increases' if val > 0 else 'decreases'} distress probability)"
            for name, val in top_shap
        ]
    )
    ratio_lines = "\n".join(
        [
            f"  - {name}: Actual = {ratios.get(name, 0.0):.3f}, "
            f"Healthy Benchmark = {benchmarks.get(name, 'N/A')}"
            for name, _ in top_shap
            if name in ratios
        ]
    )
    return f"""You are a financial health report generator named FinWatch AI for an SME early-warning system called FinWatch Zambia.

Your task is to produce a precise, factual financial health narrative using ONLY the data provided below.
The reporting period for this assessment is {period or "unspecified"}.
Note: The business {tense_verb} assessed {tense_phrase}. Use appropriate tenses in your response.

Do not introduce any claims not supported by the data. Do not give generic financial advice.
Always reference the specific numbers provided.
Write in clear, plain English suitable for a small business owner who is not a financial expert.
Length: between 180 and 220 words.

=== PREDICTION DATA ===
Risk Classification: {risk_label}
Distress Probability: {distress_probability:.1%}

=== TOP SHAP FEATURE ATTRIBUTIONS (model decision evidence) ===
{shap_lines}

=== FINANCIAL RATIOS (Actual Values vs Healthy Benchmarks) ===
{ratio_lines}

Generate the financial health narrative now. Begin directly — no headings, labels, or preamble:"""


# ASSISTANT KNOWLEDGE GUARDRAILS
ASSISTANT_GUARDRAILS = """
=== FINWATCH SYSTEM KNOWLEDGE ===
1. CREATOR: Created by David Lameck and Denise Seti as part of their BSc Computer Science dissertation research project at Cavendish University Zambia (2026).
2. TRAINING DATA: Trained using the "UCI Polish Companies Bankruptcy Dataset" (Zieba, Tomczak & Tomczak, 2016). File: '3year.arff'.
   - Records: 10,503 companies (10,008 healthy, 495 distressed).
   - Features: 64 total (FinWatch uses 10). Imbalance ratio: 20.22:1.
3. SELECTED RATIOS (10): Grounded in Altman (1968), Beaver (1966), and Ohlson (1980).
   - Current, Quick, Cash, Debt-to-Equity (inverted Attr8), Debt-to-Assets, Interest Coverage, Net Profit Margin, ROA, ROE (Derived), Asset Turnover.
4. ML PIPELINE: Stratified 80/20 train-test split. Median imputation for missing values. Outlier clipping (1st-99th). SMOTE applied ONLY to training data. StandardScaler fitted ONLY on training data.
5. MODELS: Random Forest (captures complex/nonlinear patterns) and Logistic Regression (interpretable/transparent). RANDOM_STATE=42.
6. ZAMBIA CONTEXT: "World Bank Zambia Enterprise Survey 2019-2020" was used ONLY for contextual validation (confirming local pressures like credit access and load shedding).
   - IT WAS NEVER USED for training, fine-tuning, evaluation, or accuracy validation.
7. DOMAIN SHIFT: Model weights learned entirely from Polish data. System is a Design Science Research (DSR) proof-of-concept.
   - Survey validation does not close the domain gap. Future work requires retraining on local labelled SME data.
8. PRIVACY: SME data is private. Regulator portal uses anonymised aggregate data and protects identifiable company info.
9. SCOPE: Only assist with FinWatch predictions, ratios, models, reports, and system guidance.
   - For unrelated questions, say: "I can only assist with FinWatch system functionality, financial distress predictions, ratio interpretation, report explanations, and related platform guidance."
"""

SME_USAGE_GUIDANCE = """
=== SME USAGE GUIDANCE ===
1. Create/select a company profile in 'Companies'.
2. Go to 'Predictions', select company, enter financial data.
3. Choose model (RF or LR) and run prediction.
4. View results/SHAP and export reports.
For a detailed walkthrough, open the guided tutorial via the info icon in the top-right.
"""


def build_chat_system_prompt(predictions_context: str) -> str:
    """Build the system prompt for the chat assistant."""
    return f"""You are FinWatch AI, an expert financial and business advisor embedded in FinWatch Zambia — \
an ML-based financial distress prediction system for Zambian SMEs.

Your primary goal is to help users make informed decisions by delivering professional, actionable, and context-specific guidance derived from their prediction data.

{ASSISTANT_GUARDRAILS}

BEHAVIOUR RULES:
1. ADVISOR FIRST: Prioritise answering the user's actual question with professional and practical insights. Focus entirely on the subject matter (business, financial, compliance, or performance advice).
2. ACTIONABLE RECOMMENDATIONS: Provide direct, action-oriented advice tailored specifically to the user's context and prediction results.
3. DATA-DRIVEN: Use the prediction data provided below to generate relevant insights. Reference specific ratios or risk levels.
4. STRUCTURED FORMATTING: Use Markdown to structure your response for readability. Use **bold** for key terms, *italics* for emphasis, and ### headings for distinct sections.
5. CLEAN LISTS: For unordered lists, use only the bullet character • or a dash -. Always use a NEW LINE for every list item.
6. NO UNREQUESTED GUIDANCE: Do not include generic platform instructions UNLESS the user explicitly asks for help using a feature.
7. AUTHORSHIP: Directly answer questions about who created you (David Lameck and Denise Seti) without refusal.
8. NO HALLUCINATIONS: Never claim Zambian data was used for model training.

=== USER'S PREDICTION DATA ===
{predictions_context}
=== END OF DATA ===

If the context is empty, professionally inform the user that no assessments have been run yet and advice will be more specific once they complete a prediction."""


build_prompt = build_narrative_prompt


def _call_groq(
    prompt: str, system_prompt: str | None = None, history: list[dict] | None = None
) -> str:
    """Call the Groq API for text generation."""
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")

    client = Groq(api_key=settings.GROQ_API_KEY)

    if system_prompt is not None:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-10:])
        messages.append({"role": "user", "content": prompt})
    else:
        messages = [{"role": "user", "content": prompt}]

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=settings.NLP_TEMPERATURE,
        max_tokens=settings.NLP_MAX_TOKENS,
    )
    return response.choices[0].message.content.strip()


def _call_ollama_local(
    prompt: str,
    model: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """Call the local Ollama API for text generation."""
    url = f"{settings.OLLAMA_BASE_URL}/api/chat"

    if system_prompt is not None:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-8:])
        messages.append({"role": "user", "content": prompt})
    else:
        messages = [{"role": "user", "content": prompt}]

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": settings.NLP_TEMPERATURE,
            "num_predict": settings.NLP_MAX_TOKENS,
        },
    }

    with httpx.Client(timeout=180.0) as client:
        res = client.post(url, json=payload)
        res.raise_for_status()
        return res.json()["message"]["content"].strip()


def _is_valid_key(key: str) -> bool:
    """Check if a key is provided and is not a placeholder."""
    k = key.strip()
    return bool(k) and k.lower() not in ("unset", "set", "your_api_key", "replace_me")


def _get_available_ollama_models() -> list[str]:
    """Fetch the list of model tags currently available in local Ollama."""
    try:
        url = f"{settings.OLLAMA_BASE_URL}/api/tags"
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        return []


def _resolve_ollama_model(requested: str, available: list[str]) -> str:
    """If the requested model is missing but a compatible variant is available, use it."""
    if requested in available:
        return requested

    if "granite4" in requested:
        for variant in ["granite4:latest", "granite4:3b", "granite4"]:
            if variant in available:
                logger.info(
                    "NLP: requested %s missing, using available %s", requested, variant
                )
                return variant

    if "gemma3" in requested:
        for variant in ["gemma3:4b", "gemma3:1b", "gemma3:latest", "gemma3"]:
            if variant in available:
                logger.info(
                    "NLP: requested %s missing, using available %s", requested, variant
                )
                return variant

    return requested


def _run_fallback_chain(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    log_prefix: str = "NLP",
) -> tuple[str, str]:
    """Core fallback orchestration logic. Returns (content, source)."""
    available_ollama = _get_available_ollama_models()

    primary_ollama = _resolve_ollama_model(
        settings.OLLAMA_LOCAL_MODEL_PRIMARY, available_ollama
    )
    fallback_ollama = _resolve_ollama_model(
        settings.OLLAMA_LOCAL_MODEL_FALLBACK, available_ollama
    )

    attempts = []

    if settings.NLP_PRIMARY == "groq" and _is_valid_key(settings.GROQ_API_KEY):
        attempts.append(("groq", lambda: _call_groq(prompt, system_prompt, history)))
    elif settings.NLP_PRIMARY == "ollama" and not settings.RENDER:
        attempts.append(
            (
                "ollama_local",
                lambda: _call_ollama_local(
                    prompt, primary_ollama, system_prompt, history
                ),
            )
        )

    if _is_valid_key(settings.GROQ_API_KEY) and not any(
        a[0] == "groq" for a in attempts
    ):
        attempts.append(("groq", lambda: _call_groq(prompt, system_prompt, history)))

    if not settings.RENDER and not any(a[0] == "ollama_local" for a in attempts):
        attempts.append(
            (
                "ollama_local",
                lambda: _call_ollama_local(
                    prompt, primary_ollama, system_prompt, history
                ),
            )
        )

    if not settings.RENDER:
        attempts.append(
            (
                "ollama_local_fallback",
                lambda: _call_ollama_local(
                    prompt, fallback_ollama, system_prompt, history
                ),
            )
        )

    for source, call_fn in attempts:
        try:
            target_model = (
                primary_ollama if source == "ollama_local" else fallback_ollama
            )
            if source == "groq":
                target_model = settings.GROQ_MODEL

            logger.info(
                "%s: Attempting via %s (model: %s)...", log_prefix, source, target_model
            )
            content = call_fn()
            logger.info("%s: %s succeeded", log_prefix, source)
            return content, source
        except Exception as exc:
            logger.warning("%s: %s failed — %s", log_prefix, source, exc)
            if "ollama" in source:
                import time

                time.sleep(1.0)

    raise RuntimeError("All NLP providers failed")


def generate_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    model_used: str = "random_forest",
    period: str | None = None,
) -> tuple[str, str]:
    """Generate a financial health narrative using the fallback chain."""
    prompt = build_narrative_prompt(
        risk_label=risk_label,
        distress_probability=distress_probability,
        shap_values=shap_values,
        ratios=ratios,
        benchmarks=RATIO_BENCHMARKS_DISPLAY,
        period=period,
    )

    try:
        return _run_fallback_chain(prompt, log_prefix="Narrative")
    except Exception:
        logger.info("Narrative: falling back to template engine")
        return _call_template_narrative(
            risk_label, distress_probability, shap_values, ratios, period
        ), "template"


def generate_chat_response(
    system_prompt: str,
    history: list[dict],
    message: str,
) -> tuple[str, str]:
    """Generate a chat response using the fallback chain."""
    try:
        return _run_fallback_chain(
            message, system_prompt=system_prompt, history=history, log_prefix="Chat"
        )
    except Exception:
        logger.info("Chat: falling back to template engine")
        return _call_template_chat(message), "template"


def _call_template_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    period: str | None = None,
) -> str:
    """Generate a narrative using the template engine (fallback)."""
    is_past = False
    if period:
        match = re.match(r"^(\d{4})", period)
        if match:
            year = int(match.group(1))
            if year < datetime.now().year:
                is_past = True

    tense_verb = "was" if is_past else "is"
    tense_phrase = "during the assessed period" if is_past else "currently"

    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    risk_pct = f"{distress_probability:.1%}"

    if risk_label == "Distressed":
        status = f"### Financial Assessment: DISTRESSED\n\nBased on the data for **{period or 'the assessed period'}**, this business is classified as **FINANCIALLY DISTRESSED** with a distress probability of **{risk_pct}**."
    else:
        status = f"### Financial Assessment: HEALTHY\n\nThis business is currently assessed as **FINANCIALLY HEALTHY** with a distress probability of **{risk_pct}**."

    drivers = []
    for name, val in top_shap:
        display = RATIO_DISPLAY_NAMES.get(name, name)
        actual = ratios.get(name)
        benchmark = RATIO_BENCHMARKS_DISPLAY.get(name, "N/A")
        direction = "increasing" if val > 0 else "reducing"
        actual_str = f"{actual:.3f}" if actual is not None else "N/A"
        drivers.append(
            f"• **{display}**: {actual_str} (Benchmark: {benchmark}) — {direction} distress probability by {abs(val):.4f} units."
        )

    recommendation = (
        "\n\n### Recommendation\n**Immediate attention is recommended.** Consider reviewing cash flow, liabilities, and revenue to mitigate risk."
        if risk_label == "Distressed"
        else "\n\n### Recommendation\n**Continue monitoring** these indicators regularly to maintain financial health."
    )
    return f"{status}\n\n{'\n'.join(drivers)}{recommendation}"


def _call_template_chat(message: str) -> str:
    """Generate a chat response using the template engine (fallback)."""
    q = message.lower()
    if any(k in q for k in ["who created", "who developed", "who built", "authors", "who made"]):
        return (
            "FinWatch was created by **David Lameck** and **Denise Seti** as part of their **BSc Computer Science** "
            "dissertation research project at **Cavendish University Zambia** in 2026."
        )
    if any(k in q for k in ["dataset", "data", "train", "learned from"]):
        return (
            "### Training Dataset\n\nFinWatch was trained on the **UCI Polish Companies Bankruptcy Dataset** (Zieba et al., 2016). "
            "The **World Bank Zambia Enterprise Survey** was used only for contextual validation and "
            "was never used to train or fine-tune the machine learning models."
        )
    if "zambia" in q:
        return (
            "### Zambia Context\n\nFinWatch is a **proof-of-concept system** developed for the Zambian context. While trained on "
            "Polish data, its relevance to Zambia was validated using World Bank survey data. It is a "
            "**Design Science Research (DSR)** artefact designed to bridge the SME credit gap."
        )
    if any(k in q for k in ["current ratio", "liquidity", "cash ratio", "quick ratio"]):
        return (
            "### Liquidity Ratios\n\nLiquidity ratios measure your ability to meet short-term obligations. "
            "• **Current Ratio**: Compares current assets to current liabilities. Values below 1.0 signal potential cash flow problems.\n"
            "• **Quick Ratio**: Excludes inventory for a stricter view.\n\n"
            "For Zambian SMEs, a current ratio above **1.5** is generally considered healthy."
        )
    if any(k in q for k in ["distress", "probability", "risk", "score", "prediction"]):
        return (
            "### Prediction Metrics\n\nThe **distress probability** is the model's confidence (0-100%) that a business is heading "
            "toward financial difficulty. Values above **50%** indicate elevated risk. FinWatch uses **Random Forest** "
            "and **Logistic Regression** for these assessments."
        )
    if "shap" in q:
        return (
            "### SHAP Explanations\n\n**SHAP (SHapley Additive exPlanations)** quantifies each ratio's contribution to the prediction. "
            "• **Positive SHAP**: The ratio pushes the business toward a **Distressed** classification.\n"
            "• **Negative SHAP**: The ratio pulls the business toward a **Healthy** classification.\n\n"
            "The magnitude shows how strongly each ratio influenced the result."
        )
    if any(k in q for k in ["debt", "leverage", "equity"]):
        return (
            "### Leverage Ratios\n\nLeverage ratios measure how much of your business is debt-financed. "
            "• **Debt-to-Equity**: Values above **2.0** are warning signs.\n"
            "• **Debt-to-Assets**: Values above **0.6** are red flags in FinWatch.\n\n"
            "High leverage increases financial fragility, especially combined with low profitability."
        )
    if any(k in q for k in ["interest", "coverage", "ebit"]):
        return (
            "### Interest Coverage\n\n**Interest Coverage** (EBIT divided by Interest Expense) shows how many times earnings cover interest payments. "
            "Values below **2.0** are a red flag — a large portion of earnings goes to interest, leaving little buffer if revenues drop."
        )
    if any(k in q for k in ["profit", "margin", "roa", "roe", "return"]):
        return (
            "### Profitability Ratios\n\nProfitability ratios show how efficiently your business converts revenue into profit. "
            "• **Net Margin**: Thresholds below **5%** indicate concern.\n"
            "• **ROA**: Below **2%** is a warning sign.\n"
            "• **ROE**: Below **5%** is a concern in FinWatch.\n\n"
            "Negative values indicate a loss-making business, significantly elevating distress risk."
        )
    return (
        "I can only assist with FinWatch system functionality, financial distress predictions, "
        "ratio interpretation, report explanations, and related platform guidance. "
        "For more specific advice, please ensure you have completed a prediction assessment."
    )


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """Compute a hash for narrative caching based on ratios and model."""
    canonical = json.dumps({"ratios": ratios, "model": model_used}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
