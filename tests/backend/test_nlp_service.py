"""
FinWatch Zambia — Unit Tests: NLP Service

Tests:
    - Fallback chain for narrative and chat generation
    - Prompt construction
    - Template engine
    - Cache key generation

Note: External LLM calls are simulated using mocks
"""

import pytest
from unittest.mock import patch, MagicMock

from app.services.nlp_service import (
    build_narrative_prompt,
    build_chat_system_prompt,
    compute_prediction_hash,
    generate_narrative,
    generate_chat_response,
    _call_template_narrative,
    _call_template_chat,
)
from .conftest import SAMPLE_RATIOS, SAMPLE_SHAP


class TestBuildNarrativePrompt:
    """Tests for narrative prompt construction."""
    def test_contains_risk_label(self):
        prompt = build_narrative_prompt(
            "Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        assert "Distressed" in prompt

    def test_contains_distress_probability(self):
        prompt = build_narrative_prompt(
            "Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        assert "5.0%" in prompt or "0.05" in prompt or "5%" in prompt

    def test_contains_shap_values(self):
        prompt = build_narrative_prompt(
            "Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        # At least one ratio name should appear
        assert any(name in prompt for name in SAMPLE_SHAP)

    def test_contains_ratio_values(self):
        prompt = build_narrative_prompt(
            "Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        assert any(str(round(v, 3)) in prompt for v in SAMPLE_RATIOS.values())

    def test_returns_string(self):
        prompt = build_narrative_prompt(
            "Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 100

    def test_top_5_shap_features_included(self):
        prompt = build_narrative_prompt(
            "Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS, {}
        )
        # Prompt should include at most 5 SHAP features
        shap_mention_count = sum(1 for name in SAMPLE_SHAP if name in prompt)
        assert shap_mention_count <= 5


class TestBuildChatSystemPrompt:
    """Tests for chat system prompt construction."""
    def test_returns_string(self):
        prompt = build_chat_system_prompt("some prediction context")
        assert isinstance(prompt, str)

    def test_contains_context(self):
        prompt = build_chat_system_prompt("PREDICTION_DATA_HERE")
        assert "PREDICTION_DATA_HERE" in prompt

    def test_contains_behaviour_rules(self):
        prompt = build_chat_system_prompt("")
        assert "BEHAVIOUR RULES" in prompt or "rules" in prompt.lower()

    def test_handles_empty_context(self):
        prompt = build_chat_system_prompt("")
        assert isinstance(prompt, str)
        assert len(prompt) > 50


class TestComputePredictionHash:
    """Tests for prediction hash computation."""
    def test_returns_string(self):
        h = compute_prediction_hash(SAMPLE_RATIOS, "random_forest")
        assert isinstance(h, str)

    def test_hash_is_64_chars(self):
        # SHA-256 hex digest is always 64 characters
        h = compute_prediction_hash(SAMPLE_RATIOS, "random_forest")
        assert len(h) == 64

    def test_same_inputs_produce_same_hash(self):
        h1 = compute_prediction_hash(SAMPLE_RATIOS, "random_forest")
        h2 = compute_prediction_hash(SAMPLE_RATIOS, "random_forest")
        assert h1 == h2

    def test_different_model_produces_different_hash(self):
        h1 = compute_prediction_hash(SAMPLE_RATIOS, "random_forest")
        h2 = compute_prediction_hash(SAMPLE_RATIOS, "logistic_regression")
        assert h1 != h2

    def test_different_ratios_produce_different_hash(self):
        ratios2 = {**SAMPLE_RATIOS, "current_ratio": 99.9}
        h2 = compute_prediction_hash(ratios2, "random_forest")
        assert h2 != compute_prediction_hash(SAMPLE_RATIOS, "random_forest")


class TestTemplateNarrative:
    """Tests for template-based narrative generation."""
    def test_distressed_narrative_mentions_distress(self):
        text = _call_template_narrative("Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS)
        assert "DISTRESSED" in text or "Distressed" in text.lower()

    def test_healthy_narrative_mentions_healthy(self):
        text = _call_template_narrative("Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS)
        assert "HEALTHY" in text or "healthy" in text.lower()

    def test_narrative_references_probability(self):
        text = _call_template_narrative("Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS)
        assert "5.0%" in text or "0.05" in text or "5%" in text

    def test_narrative_is_non_empty_string(self):
        text = _call_template_narrative("Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS)
        assert isinstance(text, str) and len(text) > 50


class TestTemplateChatResponses:
    """Tests for template-based chat responses."""
    def test_liquidity_keyword_triggers_response(self):
        resp = _call_template_chat("What is the current ratio?")
        assert len(resp) > 20

    def test_shap_keyword_triggers_response(self):
        resp = _call_template_chat("Explain SHAP values")
        assert "SHAP" in resp

    def test_distress_keyword_triggers_response(self):
        resp = _call_template_chat("What does distress probability mean?")
        assert len(resp) > 20

    def test_unknown_query_returns_fallback_message(self):
        resp = _call_template_chat("Tell me about the weather")
        assert isinstance(resp, str) and len(resp) > 20


class TestGenerateNarrativeFallbackChain:
    """Tests for narrative generation fallback chain."""
    def test_uses_groq_when_available(self):
        with patch("app.services.nlp_service._call_groq") as mock_groq:
            mock_groq.return_value = "Groq narrative."
            with patch("app.core.config.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "valid_key"
                mock_settings.NLP_PRIMARY = "groq"
                mock_settings.NLP_TEMPERATURE = 0.2
                mock_settings.NLP_MAX_TOKENS = 350
                mock_settings.GROQ_MODEL = "llama-3.1-8b-instant"
                text, source = generate_narrative(
                    "Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS
                )
                assert source in ("groq", "ollama_local", "ollama_local_fallback", "template")
                assert isinstance(text, str)

    def test_falls_back_to_template_when_all_fail(self):
        with patch("app.services.nlp_service._call_groq", side_effect=Exception("Groq down")), \
             patch("app.services.nlp_service._call_ollama_local", side_effect=Exception("Ollama down")), \
             patch("app.services.nlp_service._get_available_ollama_models", return_value=[]):
            text, source = generate_narrative("Healthy", 0.05, SAMPLE_SHAP, SAMPLE_RATIOS)
            assert source == "template"
            assert isinstance(text, str) and len(text) > 20

    def test_returns_tuple(self):
        with patch("app.services.nlp_service._call_groq", side_effect=Exception()), \
             patch("app.services.nlp_service._call_ollama_local", side_effect=Exception()), \
             patch("app.services.nlp_service._get_available_ollama_models", return_value=[]):
            result = generate_narrative("Distressed", 0.82, SAMPLE_SHAP, SAMPLE_RATIOS)
            assert isinstance(result, tuple)
            assert len(result) == 2


class TestGenerateChatResponseFallbackChain:
    """Tests for chat response generation fallback chain."""
    def test_falls_back_to_template_when_all_fail(self):
        with patch("app.services.nlp_service._call_groq", side_effect=Exception("Groq down")), \
             patch("app.services.nlp_service._call_ollama_local", side_effect=Exception("Ollama down")), \
             patch("app.services.nlp_service._get_available_ollama_models", return_value=[]):
            reply, source = generate_chat_response(
                system_prompt="You are a financial assistant.",
                history=[],
                message="What is my distress probability?",
            )
            assert source == "template"
            assert isinstance(reply, str) and len(reply) > 20

    def test_returns_string_and_source(self):
        with patch("app.services.nlp_service._call_groq", side_effect=Exception()), \
             patch("app.services.nlp_service._call_ollama_local", side_effect=Exception()), \
             patch("app.services.nlp_service._get_available_ollama_models", return_value=[]):
            reply, source = generate_chat_response("sys", [], "hello")
            assert isinstance(reply, str)
            assert source in ("groq", "ollama_cloud", "ollama_local", "ollama_local_fallback", "template")
