# =============================================================================
# FinWatch Zambia — Services Package
# Exposes public interfaces from all service modules.
# =============================================================================

from app.services.auth_service import get_user_by_email, get_user_by_id
from app.services.ml_service import (
    get_available_models,
    is_model_loaded,
    load_models,
    predict,
)
from app.services.nlp_service import (
    build_prompt,
    compute_prediction_hash,
    generate_narrative,
)
from app.services.ratio_engine import (
    RATIO_BENCHMARKS,
    RATIO_BENCHMARKS_DISPLAY,
    RATIO_NAMES,
    compute_ratios,
    get_ratio_benchmark_table,
    ratios_to_feature_vector,
    validate_ratio_keys,
)
from app.services.report_service import generate_pdf_report
from app.services.shap_service import (
    compute_shap_values,
    get_global_shap_importance,
    is_explainer_loaded,
    load_explainers,
)

__all__ = [
    # Auth
    "get_user_by_email",
    "get_user_by_id",
    # ML
    "load_models",
    "is_model_loaded",
    "get_available_models",
    "predict",
    # NLP
    "build_prompt",
    "compute_prediction_hash",
    "generate_narrative",
    # Ratio Engine
    "RATIO_NAMES",
    "RATIO_BENCHMARKS",
    "RATIO_BENCHMARKS_DISPLAY",
    "compute_ratios",
    "ratios_to_feature_vector",
    "validate_ratio_keys",
    "get_ratio_benchmark_table",
    # Reports
    "generate_pdf_report",
    # SHAP
    "load_explainers",
    "is_explainer_loaded",
    "compute_shap_values",
    "get_global_shap_importance",
]
