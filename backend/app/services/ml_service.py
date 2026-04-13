# =============================================================================
# FinWatch Zambia — ML Service (Stub)
# Model loading and inference logic wired in Stage 3.
# Stub defined here so imports resolve from Stage 1.
# =============================================================================

# TODO Stage 3: implement load_models(), predict(), get_available_models()
# Models are loaded once at startup from backend/ml/artifacts/
# Inference calls return (risk_label, distress_probability, shap_values)


def predict(ratios: dict, model_name: str = "random_forest") -> dict:
    raise NotImplementedError("ML service will be implemented in Stage 3.")
