# =============================================================================
# FinWatch Zambia — Application Package
#
# ML-Based Financial Distress Prediction System for Zambian SMEs
# BSc Computing, Cavendish University Zambia — COM421, 2026
#
# Package structure:
#   app/api/       — FastAPI route handlers (auth, companies, predictions,
#                    reports, admin)
#   app/core/      — Configuration, security utilities, dependency injections
#   app/db/        — Database engine, session factory, initialisation
#   app/models/    — SQLAlchemy ORM models (7 tables)
#   app/schemas/   — Pydantic request/response validation models
#   app/services/  — Business logic (ratio engine, ML, SHAP, NLP, reports)
# =============================================================================

__version__ = "1.0.0"
__author__ = "FinWatch Zambia"
