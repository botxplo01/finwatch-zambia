# =============================================================================
# FinWatch Zambia — ML Service
#
# Manages model lifecycle: loading serialized artifacts from disk,
# exposing a consistent inference interface, and reporting model availability.
#
# Models are loaded ONCE at application startup via load_models() called
# from the lifespan handler in main.py. After that, inference is stateless
# and thread-safe because scikit-learn models are read-only after fitting.
#
# Artifact files (written by ml/train.py):
#   ml/artifacts/logistic_regression.joblib  — fitted LR estimator
#   ml/artifacts/random_forest.joblib        — fitted RF estimator
#   ml/artifacts/scaler.joblib               — fitted StandardScaler
#   ml/artifacts/model_metadata.json         — training metrics and config
# =============================================================================

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.core.config import settings
from app.services.ratio_engine import RATIO_NAMES, validate_ratio_keys

logger = logging.getLogger(__name__)

# =============================================================================
# Module-level model registry
# Populated by load_models() at startup. Read-only after that.
# =============================================================================

_models: dict[str, Any] = {}
_scaler: Any = None
_model_metadata: dict[str, Any] = {}

SUPPORTED_MODELS: list[str] = ["random_forest", "logistic_regression"]

# Class index for "Distressed" in predict_proba() output.
# Training labels: 0 = Healthy, 1 = Distressed.
DISTRESS_CLASS_INDEX: int = 1


# =============================================================================
# Helpers
# =============================================================================


def ratios_to_feature_vector(ratios: dict[str, float]) -> list[float]:
    """
    Convert a ratio dict to an ordered feature vector matching training order.
    RATIO_NAMES defines the canonical order used during training.
    """
    return [float(ratios[name]) for name in RATIO_NAMES]


# =============================================================================
# Loading
# =============================================================================


def load_models() -> None:
    """
    Load all serialized ML model artifacts from the artifacts directory.
    Called once at application startup. Safe to call if artifacts are missing —
    logs a warning and returns, leaving the app in degraded (HTTP 503) state.
    """
    global _scaler

    artifacts_path = settings.ml_artifacts_path
    logger.info("Loading ML models from: %s", artifacts_path)

    if not artifacts_path.exists():
        logger.warning(
            "ML artifacts directory not found at %s. "
            "Run `python ml/train.py` to generate model artifacts. "
            "Prediction endpoints will return HTTP 503 until models are loaded.",
            artifacts_path,
        )
        return

    # Load scaler
    scaler_path = artifacts_path / "scaler.joblib"
    if scaler_path.exists():
        _scaler = joblib.load(scaler_path)
        logger.info("StandardScaler loaded from: %s", scaler_path)
    else:
        logger.warning(
            "scaler.joblib not found at %s — predictions will use unscaled features",
            scaler_path,
        )

    # Load models
    for model_name in SUPPORTED_MODELS:
        artifact_file = artifacts_path / f"{model_name}.joblib"
        if artifact_file.exists():
            _models[model_name] = joblib.load(artifact_file)
            logger.info("Loaded model '%s' from: %s", model_name, artifact_file)
        else:
            logger.warning(
                "Artifact not found for model '%s' at %s", model_name, artifact_file
            )

    # Load metadata
    metadata_file = artifacts_path / "model_metadata.json"
    if metadata_file.exists():
        _model_metadata.update(json.loads(metadata_file.read_text()))
        logger.info("Model metadata loaded from: %s", metadata_file)

    logger.info(
        "ML loading complete. Models available: %s",
        list(_models.keys()),
    )


def is_model_loaded(model_name: str) -> bool:
    """Check whether a specific model is loaded and ready for inference."""
    return model_name in _models


def get_available_models() -> list[str]:
    """Return the names of all models currently loaded and ready for inference."""
    return list(_models.keys())


def get_model_metadata(model_name: str) -> dict:
    """Return training metadata for a specific model."""
    return _model_metadata.get("models", {}).get(model_name, {})


# =============================================================================
# Inference
# =============================================================================


def predict(
    ratios: dict[str, float],
    model_name: str = "random_forest",
) -> dict[str, Any]:
    """
    Run ML inference on a set of financial ratios and return a prediction.

    Args:
        ratios:     Dict mapping ratio name → float value.
                    Must contain exactly the 10 keys in RATIO_NAMES.
        model_name: "random_forest" or "logistic_regression".
                    Defaults to random_forest (superior overall metrics per
                    Barboza, Kimura and Altman, 2017).

    Returns:
        Dict with keys:
            risk_label           — "Distressed" or "Healthy"
            distress_probability — float in [0.0, 1.0]
            model_name           — echoed back for traceability

    Raises:
        ValueError:   If ratios dict is malformed or model_name is invalid.
        RuntimeError: If the requested model is not loaded.
    """
    if model_name not in SUPPORTED_MODELS:
        raise ValueError(f"Unknown model '{model_name}'. Supported: {SUPPORTED_MODELS}")

    validate_ratio_keys(ratios)

    if not is_model_loaded(model_name):
        raise RuntimeError(
            f"Model '{model_name}' is not loaded. "
            "Run `python ml/train.py` to generate artifacts, "
            "then restart the server."
        )

    # Build ordered feature vector
    feature_vector = ratios_to_feature_vector(ratios)
    X = np.array([feature_vector])

    # Apply scaler if available (models were trained on scaled features)
    if _scaler is not None:
        X = _scaler.transform(X)

    # Run inference
    model = _models[model_name]
    proba = model.predict_proba(X)[0]
    distress_prob = float(proba[DISTRESS_CLASS_INDEX])
    risk_label = "Distressed" if distress_prob >= 0.5 else "Healthy"

    logger.debug(
        "Prediction [%s]: risk=%s, distress_prob=%.4f",
        model_name,
        risk_label,
        distress_prob,
    )

    return {
        "risk_label": risk_label,
        "distress_probability": distress_prob,
        "model_name": model_name,
    }
