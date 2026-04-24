# =============================================================================
# FinWatch Zambia — FastAPI Application Entry Point
# Run: uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# =============================================================================

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    auth,
    chat,
    companies,
    predictions,
    regulator,
    regulator_chat,
    reports,
)
from app.core.config import settings
from app.db.database import check_db_connection
from app.db.init_db import init_db
from app.services.ml_service import load_models
from app.services.shap_service import load_explainers


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    load_models()
    load_explainers()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "ML-Based Financial Distress Prediction System for Zambian SMEs. "
        "Provides interpretable distress risk scores, SHAP-based feature "
        "attributions, and natural language financial health narratives."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── SME Portal Routers ────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# ── Regulator Portal Routers ──────────────────────────────────────────────────
app.include_router(regulator.router, prefix="/api/regulator", tags=["Regulator"])
app.include_router(
    regulator_chat.router, prefix="/api/regulator/chat", tags=["Regulator Chat"]
)


@app.get("/health", tags=["Health"])
async def health_check():
    from app.services.ml_service import get_available_models

    db_ok = check_db_connection()
    loaded_models = get_available_models()
    models_ok = len(loaded_models) > 0
    overall = "ok" if (db_ok and models_ok) else "degraded"
    return {
        "status": overall,
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "checks": {
            "database": "ok" if db_ok else "unavailable",
            "ml_models": "ok" if models_ok else "not_loaded",
            "models_loaded": loaded_models,
        },
    }
