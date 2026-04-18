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
# Artifact files (written by ml/train.py, Stage 3):
#   ml/artifacts/logistic_regression.joblib  — fitted LR pipeline
#   ml/artifacts/random_forest.joblib        — fitted RF pipeline
#   ml/artifacts/scaler.joblib               — fitted StandardScaler
#   ml/artifacts/model_metadata.json         — training metrics and config
#
# Stage 3 implementation note:
#   Replace the NotImplementedError bodies in load_models() and predict()
#   with joblib.load() calls and pipeline.predict_proba() calls.
#   The interface (function signatures and return types) is locked here
#   and must not change — the predictions router depends on it.
# =============================================================================

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.ratio_engine import RATIO_NAMES, validate_ratio_keys

logger = logging.getLogger(__name__)

# =============================================================================
# Module-level model registry
# Populated by load_models() at startup. Read-only after that.
# =============================================================================

# Fitted scikit-learn pipeline objects keyed by model name
_models: dict[str, Any] = {}

# Training metadata loaded from model_metadata.json
_model_metadata: dict[str, dict] = {}

# Supported model names — must match artifact filenames
SUPPORTED_MODELS: list[str] = ["random_forest", "logistic_regression"]

# The class index that represents "Distressed" in predict_proba() output.
# Established during training in ml/train_models.py and confirmed here.
# If the training label encoder maps {0: "Healthy", 1: "Distressed"},
# DISTRESS_CLASS_INDEX = 1.
DISTRESS_CLASS_INDEX: int = 1


# =============================================================================
# Loading
# =============================================================================


def load_models() -> None:
    """
    Load all serialized ML model artifacts from the artifacts directory.

    Called once at application startup by the lifespan handler in main.py.
    Safe to call if artifacts do not yet exist (pre-Stage 3) — logs a
    warning and returns without raising, allowing the app to start in a
    degraded state where predictions return HTTP 503.

    Stage 3 implementation:
        import joblib
        for model_name in SUPPORTED_MODELS:
            path = settings.ml_artifacts_path / f"{model_name}.joblib"
            _models[model_name] = joblib.load(path)
        metadata_path = settings.ml_artifacts_path / "model_metadata.json"
        _model_metadata.update(json.loads(metadata_path.read_text()))
    """
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

    # TODO Stage 3: Replace with joblib.load() calls
    for model_name in SUPPORTED_MODELS:
        artifact_file = artifacts_path / f"{model_name}.joblib"
        if artifact_file.exists():
            # Stage 3: _models[model_name] = joblib.load(artifact_file)
            logger.info(
                "Found artifact for %s — load implementation in Stage 3", model_name
            )
        else:
            logger.warning(
                "Artifact not found for model '%s' at %s", model_name, artifact_file
            )

    # TODO Stage 3: Load metadata
    metadata_file = artifacts_path / "model_metadata.json"
    if metadata_file.exists():
        logger.info("Found model_metadata.json — load implementation in Stage 3")


def is_model_loaded(model_name: str) -> bool:
    """
    Check whether a specific model is loaded and ready for inference.

    Args:
        model_name: "random_forest" or "logistic_regression"

    Returns:
        True if the model is in the registry and ready to use.
    """
    return model_name in _models


def get_available_models() -> list[str]:
    """
    Return the names of all models currently loaded and ready for inference.

    Returns:
        List of model name strings. Empty before load_models() is called
        or if artifacts were not found.
    """
    return list(_models.keys())


def get_model_metadata(model_name: str) -> dict:
    """
    Return training metadata for a specific model.

    Includes: training date, dataset size, CV scores, and evaluation metrics.
    Populated from model_metadata.json written by ml/evaluate.py.

    Args:
        model_name: "random_forest" or "logistic_regression"

    Returns:
        Metadata dict, or empty dict if not yet loaded.
    """
    return _model_metadata.get(model_name, {})


# =============================================================================
# Inference
# =============================================================================


def predict(
    ratios: dict[str, float],
    model_name: str = "random_forest",
) -> dict[str, Any]:
    """
    Run ML inference on a set of financial ratios and return a prediction.

    This is the primary inference interface. The predictions router calls
    this function directly — do not change the signature.

    Args:
        ratios:     Dict mapping ratio name → float value.
                    Must contain exactly the 10 keys in RATIO_NAMES.
        model_name: Which model to use — "random_forest" or
                    "logistic_regression". Defaults to random_forest
                    (superior recall on imbalanced datasets per
                    Barboza, Kimura and Altman, 2017).

    Returns:
        Dict with keys:
            risk_label           — "Distressed" or "Healthy"
            distress_probability — float in [0.0, 1.0]
            model_name           — echoed back for traceability

    Raises:
        NotImplementedError: Until Stage 3 implements this.
        ValueError:          If ratios dict is malformed or model_name invalid.
        RuntimeError:        If the model is not loaded (artifacts missing).

    Stage 3 implementation:
        validate_ratio_keys(ratios)
        feature_vector = ratios_to_feature_vector(ratios)
        model = _models[model_name]
        proba = model.predict_proba([feature_vector])[0]
        distress_prob = float(proba[DISTRESS_CLASS_INDEX])
        label = "Distressed" if distress_prob >= 0.5 else "Healthy"
        return {"risk_label": label, "distress_probability": distress_prob,
                "model_name": model_name}
    """
    if model_name not in SUPPORTED_MODELS:
        raise ValueError(f"Unknown model '{model_name}'. Supported: {SUPPORTED_MODELS}")

    validate_ratio_keys(ratios)

    if not is_model_loaded(model_name):
        raise NotImplementedError(
            f"Model '{model_name}' is not loaded. "
            "Run `python ml/train.py` to generate artifacts, "
            "then restart the server."
        )

    # TODO Stage 3: Implement inference here
    raise NotImplementedError("ML inference will be implemented in Stage 3.")
