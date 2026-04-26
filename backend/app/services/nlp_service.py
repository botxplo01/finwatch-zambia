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
import re
import logging
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
    return f"""You are a financial health report generator for an SME early-warning system called FinWatch Zambia.

Your task is to produce a precise, factual financial health narrative using ONLY the data provided below.
The reporting period for this assessment is {period or 'unspecified'}. 
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


def build_chat_system_prompt(predictions_context: str) -> str:
    """Build the system prompt for the chat assistant."""
    return f"""You are FinWatch AI, an expert financial assistant embedded in FinWatch Zambia — \
an ML-based financial distress prediction system for Zambian SMEs.

Your role is to help SME owners understand their financial assessment results in plain, accessible language.

BEHAVIOUR RULES:
1. Always ground answers in the user's actual prediction data shown below.
2. Never invent numbers or make claims not supported by the data.
3. If the user asks about a SPECIFIC prediction (names a company or period), give a clear and \
reasonably detailed explanation of that prediction.
4. If the user asks to explain "my prediction" or "the prediction" WITHOUT specifying which one, \
ask them to clarify which company and period they mean BEFORE answering.
5. If the user explicitly asks to explain ALL predictions, give a brief high-level overview \
covering all collectively — do NOT give detailed individual explanations for each.
6. Write in plain English suitable for a non-specialist small business owner.
7. Keep responses concise — 100 to 200 words unless a detailed explanation is explicitly requested.
8. Never give generic financial advice unrelated to the user's data.
9. You may explain financial concepts (SHAP, ratios, distress probability) when asked.
10. Stay strictly within the scope of financial health analysis.

=== USER'S PREDICTION DATA ===
{predictions_context}
=== END OF DATA ===

If the predictions context is empty, tell the user no predictions have been run yet and \
encourage them to run their first assessment."""


build_prompt = build_narrative_prompt


def _call_groq(prompt: str, system_prompt: str | None = None, history: list[dict] | None = None) -> str:
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


def _call_ollama_local(prompt: str, model: str, system_prompt: str | None = None, history: list[dict] | None = None) -> str:
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
                logger.info("NLP: requested %s missing, using available %s", requested, variant)
                return variant

    if "gemma3" in requested:
        for variant in ["gemma3:4b", "gemma3:1b", "gemma3:latest", "gemma3"]:
            if variant in available:
                logger.info("NLP: requested %s missing, using available %s", requested, variant)
                return variant

    return requested


def _run_fallback_chain(
    prompt: str,
    system_prompt: str | None = None,
    history: list[dict] | None = None,
    log_prefix: str = "NLP"
) -> tuple[str, str]:
    """Core fallback orchestration logic. Returns (content, source)."""
    available_ollama = _get_available_ollama_models()

    primary_ollama = _resolve_ollama_model(settings.OLLAMA_LOCAL_MODEL_PRIMARY, available_ollama)
    fallback_ollama = _resolve_ollama_model(settings.OLLAMA_LOCAL_MODEL_FALLBACK, available_ollama)

    attempts = []

    if settings.NLP_PRIMARY == "groq" and _is_valid_key(settings.GROQ_API_KEY):
        attempts.append(("groq", lambda: _call_groq(prompt, system_prompt, history)))
    elif settings.NLP_PRIMARY == "ollama" and not settings.RENDER:
        attempts.append(("ollama_local", lambda: _call_ollama_local(prompt, primary_ollama, system_prompt, history)))

    if _is_valid_key(settings.GROQ_API_KEY) and not any(a[0] == "groq" for a in attempts):
        attempts.append(("groq", lambda: _call_groq(prompt, system_prompt, history)))

    if not settings.RENDER and not any(a[0] == "ollama_local" for a in attempts):
        attempts.append(("ollama_local", lambda: _call_ollama_local(prompt, primary_ollama, system_prompt, history)))

    if not settings.RENDER:
        attempts.append(("ollama_local_fallback", lambda: _call_ollama_local(prompt, fallback_ollama, system_prompt, history)))

    for source, call_fn in attempts:
        try:
            target_model = primary_ollama if source == "ollama_local" else fallback_ollama
            if source == "groq": target_model = settings.GROQ_MODEL
            
            logger.info("%s: Attempting via %s (model: %s)...", log_prefix, source, target_model)
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
        return _call_template_narrative(risk_label, distress_probability, shap_values, ratios, period), "template"


def generate_chat_response(
    system_prompt: str,
    history: list[dict],
    message: str,
) -> tuple[str, str]:
    """Generate a chat response using the fallback chain."""
    try:
        return _run_fallback_chain(message, system_prompt=system_prompt, history=history, log_prefix="Chat")
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
        status = f"Based on the data for {period or 'the assessed period'}, this business {tense_verb} classified as FINANCIALLY DISTRESSED with a distress probability of {risk_pct}."
    else:
        status = f"This business {tense_verb} {tense_phrase} assessed as FINANCIALLY HEALTHY with a distress probability of {risk_pct}."
    
    drivers = []
    for name, val in top_shap:
        display = RATIO_DISPLAY_NAMES.get(name, name)
        actual = ratios.get(name)
        benchmark = RATIO_BENCHMARKS_DISPLAY.get(name, "N/A")
        direction = "increasing" if val > 0 else "reducing"
        actual_str = f"{actual:.3f}" if actual is not None else "N/A"
        drivers.append(
            f"The {display} stood at {actual_str} (benchmark: {benchmark}), " if is_past else
            f"The {display} stands at {actual_str} (benchmark: {benchmark}), "
        )
        drivers[-1] += f"{direction} distress probability by {abs(val):.4f} SHAP units."
        
    recommendation = (
        "Immediate attention is recommended. Consider reviewing cash flow, liabilities, and revenue."
        if risk_label == "Distressed"
        else "Continue monitoring these indicators regularly to maintain financial health."
    )
    return f"{status} {' '.join(drivers)} {recommendation}"


def _call_template_chat(message: str) -> str:
    """Generate a chat response using the template engine (fallback)."""
    q = message.lower()
    if any(k in q for k in ["current ratio", "liquidity", "cash ratio", "quick ratio"]):
        return (
            "Liquidity ratios measure your ability to meet short-term obligations. The current ratio "
            "compares current assets to current liabilities — below 1.0 signals potential cash flow "
            "problems. The quick ratio excludes inventory for a stricter view. For Zambian SMEs, a "
            "current ratio above 1.5 is generally considered healthy."
        )
    if any(k in q for k in ["distress", "probability", "risk", "score", "prediction"]):
        return (
            "The distress probability is the model's confidence (0–100%) that a business is heading "
            "toward financial difficulty. Values above 50% indicate elevated risk. FinWatch uses Random "
            "Forest and Logistic Regression — RF takes precedence when they disagree as it achieves "
            "higher F1 scores on the training dataset."
        )
    if "shap" in q:
        return (
            "SHAP (SHapley Additive exPlanations) quantifies each ratio's contribution to the prediction. "
            "A positive SHAP value means that ratio pushes toward Distressed. Negative pulls toward Healthy. "
            "The magnitude shows how strongly each ratio influenced the result."
        )
    if any(k in q for k in ["debt", "leverage", "equity"]):
        return (
            "Leverage ratios measure how much of your business is debt-financed. Debt-to-equity above 2.0 "
            "and debt-to-assets above 0.6 are warning signs in FinWatch. High leverage increases financial "
            "fragility, especially combined with low profitability."
        )
    if any(k in q for k in ["interest", "coverage", "ebit"]):
        return (
            "Interest coverage (EBIT ÷ Interest Expense) shows how many times earnings cover interest payments. "
            "Below 2.0 is a red flag — a large portion of earnings goes to interest, leaving little buffer "
            "if revenues drop."
        )
    if any(k in q for k in ["profit", "margin", "roa", "roe", "return"]):
        return (
            "Profitability ratios show how efficiently your business converts revenue into profit. "
            "Net margin below 5%, ROA below 2%, and ROE below 5% are concern thresholds in FinWatch. "
            "Negative values indicate a loss-making business, significantly elevating distress risk."
        )
    return (
        "The AI chat service is temporarily offline. Your prediction results, SHAP charts, and "
        "auto-generated narratives are still available on each prediction's detail panel. "
        "Please try again shortly."
    )


def compute_prediction_hash(ratios: dict[str, float], model_used: str) -> str:
    """Compute a hash for narrative caching based on ratios and model."""
    canonical = json.dumps({"ratios": ratios, "model": model_used}, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
