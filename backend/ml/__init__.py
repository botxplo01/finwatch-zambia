"""
FinWatch Zambia - ML Training Pipeline Package

Offline pipeline run once to produce serialized model artifacts.
All scripts are invoked via train.py (the entry point).

Pipeline stages:
- preprocess.py    — UCI dataset loading, feature mapping, SMOTE, scaling
- train_models.py  — LR + RF training with cross-validation and GridSearchCV
- evaluate.py      — metrics, confusion matrices, ROC/PR curves
- explain.py       — SHAP TreeExplainer + LinearExplainer, global importance

Usage (from backend/):
  python ml/train.py
  python ml/train.py --data-path ../../data/3year.arff --year 3

Artifacts written to ml/artifacts/ (excluded from Git):
- random_forest.joblib, logistic_regression.joblib, scaler.joblib
- X_test.npy, y_test.npy, feature_names.json, model_metadata.json
- shap_explainer_random_forest.joblib
- shap_explainer_logistic_regression.joblib
- shap_global_random_forest.json, shap_global_logistic_regression.json
"""

from ml.evaluate import evaluate_all_models
from ml.explain import explain_all_models
from ml.preprocess import load_and_preprocess
from ml.train_models import train_all_models

__all__ = [
    "load_and_preprocess",
    "train_all_models",
    "evaluate_all_models",
    "explain_all_models",
]
