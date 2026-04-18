# =============================================================================
# FinWatch Zambia — NLP Narrative Service
#
# Generates grounded natural language financial health narratives from
# structured ML prediction outputs (risk label, probability, SHAP values,
# ratio values).
#
# Fallback chain:
#   1. Groq Cloud  (llama-3.1-8b-instant) — best quality, free tier
#   2. Ollama Local (qwen2.5:3b)          — offline resilience
#   3. Template Engine (f-strings)         — deterministic, always available
#
# Design principle: Every narrative must remain GROUNDED — the model is
# constrained by a structured prompt to reference only the provided numbers
# and never introduce unsupported claims. Temperature is set to 0.2 to
# minimise hallucination.
# =============================================================================

from __future__ import annotations

import hashlib
import json
import logging

import httpx
from groq import Groq

from app.core.config import settings
from app.services.ratio_engine import RATIO_BENCHMARKS_DISPLAY, RATIO_DISPLAY_NAMES

logger = logging.getLogger(__name__)


# =============================================================================
# Prompt Engineering
# =============================================================================


def build_prompt(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    benchmarks: dict[str, str],  # Use RATIO_BENCHMARKS_DISPLAY from ratio_engine
) -> str:
    """
    Construct a structured, grounding-enforcing prompt for the LLM.

    The prompt explicitly instructs the model to:
    - Reference only the supplied numbers
    - Never introduce unsupported financial advice
    - Write in clear English for a non-specialist business owner
    - Keep output between 180 and 220 words

    Args:
        risk_label:            "Distressed" or "Healthy"
        distress_probability:  Float between 0.0 and 1.0
        shap_values:           Dict of ratio name → SHAP attribution value
        ratios:                Dict of ratio name → actual computed value
        benchmarks:            Dict of ratio name → healthy benchmark string

    Returns:
        Formatted prompt string ready for inference.
    """
    # Sort SHAP values by absolute magnitude (most influential first)
    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:5]

    shap_lines = "\n".join(
        [
            f"  - {name}: {val:+.4f} "
            f"({'increases' if val > 0 else 'decreases'} distress probability)"
            for name, val in top_shap
        ]
    )

    ratio_lines = "\n".join(
        [
            f"  - {name}: Actual = {ratios.get(name, 'N/A'):.3f}, "
            f"Healthy Benchmark = {benchmarks.get(name, 'N/A')}"
            for name, _ in top_shap
            if name in ratios
        ]
    )

    return f"""You are a financial health report generator for an SME early-warning system called FinWatch Zambia.

Your task is to produce a precise, factual financial health narrative using ONLY the data provided below.
Do not introduce any claims not supported by the data.
Do not give generic financial advice.
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

Generate the financial health narrative now. Begin directly with the assessment — do not include headings, labels, or preamble:"""


# =============================================================================
# Inference — Tier 1: Groq Cloud
# =============================================================================


def _call_groq(prompt: str) -> str:
    """
    Call the Groq Cloud API using the official groq Python client.
    Model: llama-3.1-8b-instant (free tier, ~300 tok/sec).
    Raises an exception if the call fails — caller handles fallback.
    """
    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=settings.NLP_TEMPERATURE,
        max_tokens=settings.NLP_MAX_TOKENS,
    )
    return response.choices[0].message.content.strip()


# =============================================================================
# Inference — Tier 2: Ollama Local
# =============================================================================


def _call_ollama(prompt: str) -> str:
    """
    Call the local Ollama inference server.
    Model: qwen2.5:3b (1.9GB, CPU inference on i7 8th Gen ~8–15 tok/sec).
    Raises an exception if Ollama is not running — caller handles fallback.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": settings.NLP_TEMPERATURE,
            "num_predict": settings.NLP_MAX_TOKENS,
        },
    }
    with httpx.Client(timeout=90.0) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        return response.json()["response"].strip()


# =============================================================================
# Inference — Tier 3: Template Engine (deterministic fallback)
# =============================================================================


def _call_template(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
) -> str:
    """
    Generate a deterministic narrative using f-string templates.
    Always available — requires no external services.
    Produces a factual, structured summary from the same grounded data.
    """
    top_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
    risk_pct = f"{distress_probability:.1%}"

    status_line = (
        f"This business has been classified as FINANCIALLY DISTRESSED "
        f"with a distress probability of {risk_pct}."
        if risk_label == "Distressed"
        else f"This business is currently assessed as FINANCIALLY HEALTHY "
        f"with a distress probability of {risk_pct}."
    )

    driver_lines = []
    for name, val in top_shap:
        display = RATIO_DISPLAY_NAMES.get(name, name)
        actual = ratios.get(name)
        benchmark = RATIO_BENCHMARKS_DISPLAY.get(name, "N/A")
        direction = "increasing" if val > 0 else "reducing"
        actual_str = f"{actual:.3f}" if actual is not None else "N/A"
        driver_lines.append(
            f"The {display} stands at {actual_str} (healthy benchmark: {benchmark}), "
            f"{direction} the predicted distress probability by {abs(val):.4f} SHAP units."
        )

    drivers_text = " ".join(driver_lines)

    recommendation = (
        "Immediate attention is recommended to address the key financial drivers "
        "identified above. Consider reviewing cash flow management, liability "
        "obligations, and revenue generation strategies."
        if risk_label == "Distressed"
        else "The business should continue monitoring these financial indicators "
        "on a regular basis to maintain its current healthy financial position."
    )

    return f"{status_line} {drivers_text} {recommendation}"


# =============================================================================
# Cache Key Generation
# =============================================================================


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """
    Generate a deterministic SHA-256 hash from the ratio values and model name.
    Used as a cache key to retrieve stored narratives for identical inputs,
    avoiding redundant API calls.
    """
    canonical = json.dumps(
        {"ratios": ratios, "model": model_used},
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


# =============================================================================
# Public Interface
# =============================================================================


def generate_narrative(
    risk_label: str,
    distress_probability: float,
    shap_values: dict[str, float],
    ratios: dict[str, float],
    model_used: str = "random_forest",
) -> tuple[str, str]:
    """
    Generate a grounded natural language financial health narrative.

    Attempts inference in fallback order:
      Groq Cloud → Ollama Local → Template Engine

    Args:
        risk_label:           "Distressed" or "Healthy"
        distress_probability: Float between 0.0 and 1.0
        shap_values:          Dict of ratio name → SHAP attribution
        ratios:               Dict of ratio name → actual ratio value
        model_used:           ML model that produced the prediction

    Returns:
        Tuple of (narrative_text: str, source: str)
        source is one of: "groq" | "ollama" | "template"
    """
    prompt = build_prompt(
        risk_label=risk_label,
        distress_probability=distress_probability,
        shap_values=shap_values,
        ratios=ratios,
        benchmarks=RATIO_BENCHMARKS_DISPLAY,
    )

    # -------------------------------------------------------------------------
    # Tier 1: Groq Cloud
    # -------------------------------------------------------------------------
    if settings.GROQ_API_KEY:
        try:
            logger.info(
                "NLP inference: attempting Groq Cloud (%s)", settings.GROQ_MODEL
            )
            text = _call_groq(prompt)
            logger.info("NLP inference: Groq succeeded (%d chars)", len(text))
            return text, "groq"
        except Exception as exc:
            logger.warning("NLP inference: Groq failed — %s", exc)
    else:
        logger.warning("NLP inference: GROQ_API_KEY not set, skipping Groq tier")

    # -------------------------------------------------------------------------
    # Tier 2: Ollama Local
    # -------------------------------------------------------------------------
    try:
        logger.info(
            "NLP inference: attempting Ollama local (%s)", settings.OLLAMA_MODEL
        )
        text = _call_ollama(prompt)
        logger.info("NLP inference: Ollama succeeded (%d chars)", len(text))
        return text, "ollama"
    except Exception as exc:
        logger.warning("NLP inference: Ollama failed — %s", exc)

    # -------------------------------------------------------------------------
    # Tier 3: Template Engine
    # -------------------------------------------------------------------------
    logger.info("NLP inference: falling back to template engine")
    text = _call_template(risk_label, distress_probability, shap_values, ratios)
    return text, "template"
