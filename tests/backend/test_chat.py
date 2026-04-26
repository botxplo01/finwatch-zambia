"""
FinWatch Zambia - Integration Tests: SME Chat Endpoint

Tests:
    - POST /api/chat/

Coverage:
    - Authentication and authorization
    - Message validation
    - Response schema validation
    - Conversation history handling
    - NLP service fallback behavior
    - Context injection with predictions
"""

import pytest
from unittest.mock import patch


class TestChatAuth:
    """Tests for authentication and validation."""
    def test_unauthenticated_request_rejected(self, client):
        res = client.post("/api/chat/", json={"message": "Hello"})
        assert res.status_code == 401

    def test_authenticated_request_accepted(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Test reply", "template")):
            res = client.post("/api/chat/", json={"message": "Hello"}, headers=sme_headers)
            assert res.status_code == 200

    def test_regulator_token_rejected(self, client, regulator_headers):
        """Regulator tokens must not work on the SME chat endpoint."""
        res = client.post("/api/chat/", json={"message": "Hello"}, headers=regulator_headers)
        assert res.status_code in (401, 403)


class TestChatValidation:
    """Tests for message validation."""
    def test_empty_message_rejected(self, client, sme_headers):
        res = client.post("/api/chat/", json={"message": ""}, headers=sme_headers)
        assert res.status_code == 400

    def test_whitespace_only_message_rejected(self, client, sme_headers):
        res = client.post("/api/chat/", json={"message": "   "}, headers=sme_headers)
        assert res.status_code == 400

    def test_missing_message_field_rejected(self, client, sme_headers):
        res = client.post("/api/chat/", json={}, headers=sme_headers)
        assert res.status_code == 422


class TestChatResponseSchema:
    """Tests for response schema validation."""
    def test_response_has_reply_field(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Test reply.", "groq")):
            res = client.post("/api/chat/", json={"message": "What is SHAP?"}, headers=sme_headers)
            assert "reply" in res.json()

    def test_response_has_source_field(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Test reply.", "groq")):
            res = client.post("/api/chat/", json={"message": "What is SHAP?"}, headers=sme_headers)
            assert "source" in res.json()

    def test_source_is_valid_value(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Reply.", "groq")):
            res = client.post("/api/chat/", json={"message": "Hello"}, headers=sme_headers)
            assert res.json()["source"] in ("groq", "ollama_cloud", "ollama_local", "ollama_local_fallback", "template")

    def test_reply_is_non_empty_string(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("This is the reply.", "template")):
            res = client.post("/api/chat/", json={"message": "Explain my prediction"}, headers=sme_headers)
            reply = res.json()["reply"]
            assert isinstance(reply, str) and len(reply) > 0


class TestChatHistory:
    """Tests for conversation history handling."""
    def test_empty_history_accepted(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Reply.", "template")):
            res = client.post(
                "/api/chat/",
                json={"message": "Hello", "history": []},
                headers=sme_headers,
            )
            assert res.status_code == 200

    def test_history_with_prior_turns_accepted(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", return_value=("Reply.", "template")):
            res = client.post(
                "/api/chat/",
                json={
                    "message": "Tell me more",
                    "history": [
                        {"role": "user", "content": "What is distress probability?"},
                        {"role": "assistant", "content": "It is the model's confidence score."},
                    ],
                },
                headers=sme_headers,
            )
            assert res.status_code == 200

    def test_history_is_passed_to_nlp_service(self, client, sme_headers):
        """Verify history is forwarded to generate_chat_response."""
        with patch("app.api.chat.generate_chat_response", return_value=("Reply.", "groq")) as mock_fn:
            client.post(
                "/api/chat/",
                json={
                    "message": "Follow-up question",
                    "history": [
                        {"role": "user", "content": "Previous question"},
                        {"role": "assistant", "content": "Previous answer"},
                    ],
                },
                headers=sme_headers,
            )
            call_kwargs = mock_fn.call_args
            history_passed = call_kwargs[1].get("history") or call_kwargs[0][1]
            assert len(history_passed) == 2


class TestChatContextInjection:
    """Tests for context injection with predictions."""
    def test_chat_works_with_no_predictions(self, client, sme_headers):
        """User with no predictions should still get a valid response."""
        with patch("app.api.chat.generate_chat_response", return_value=("No predictions yet.", "template")):
            res = client.post("/api/chat/", json={"message": "Explain my data"}, headers=sme_headers)
            assert res.status_code == 200

    def test_chat_works_with_existing_predictions(
        self, client, sme_headers, mock_models, mock_explainers, mock_nlp, db, sme_user, company, financial_record, ratio_feature, prediction_with_narrative
    ):
        """User with predictions should have context injected into the prompt."""
        with patch("app.api.chat.generate_chat_response", return_value=("Context-aware reply.", "groq")) as mock_fn:
            res = client.post(
                "/api/chat/",
                json={"message": "Explain my latest prediction"},
                headers=sme_headers,
            )
            assert res.status_code == 200
            # system_prompt should have been non-empty (context injected)
            call_args = mock_fn.call_args
            system_prompt = call_args[1].get("system_prompt") or call_args[0][0]
            assert len(system_prompt) > 100


class TestChatNLPFailure:
    """Tests for NLP service failure handling."""
    def test_service_unavailable_returns_503(self, client, sme_headers):
        with patch("app.api.chat.generate_chat_response", side_effect=Exception("All providers down")):
            res = client.post("/api/chat/", json={"message": "Hello"}, headers=sme_headers)
            assert res.status_code == 503
