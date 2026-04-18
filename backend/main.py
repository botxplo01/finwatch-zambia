# =============================================================================
# FinWatch Zambia — FastAPI Application Entry Point
# Run: uvicorn main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# =============================================================================

from contextlib import asynccontextmanager

from app.api import admin, auth, companies, predictions, reports
from app.core.config import settings
from app.db.database import check_db_connection
from app.db.init_db import init_db
from app.services.ml_service import load_models
from app.services.shap_service import load_explainers
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Startup sequence (order matters):
      1. init_db()       — create tables, ensure reports directory exists
      2. load_models()   — load serialized ML artifacts from ml/artifacts/
      3. load_explainers() — load serialized SHAP explainers

    Steps 2 and 3 are safe no-ops if artifacts do not yet exist (pre-Stage 3).
    The app starts in a degraded state where prediction endpoints return HTTP 503
    until `python ml/train.py` is run and the server is restarted.

    Teardown: add any cleanup logic below the yield (e.g. connection pool drain).
    """
    # --- Startup ---
    init_db()
    load_models()
    load_explainers()
    yield
    # --- Shutdown ---
    # Nothing to clean up for SQLite — connections are pooled and managed
    # per-request via get_db(). Add cleanup here if switching to PostgreSQL.


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

# -----------------------------------------------------------------------------
# CORS — allow Next.js frontend during development
# In production, restrict ALLOWED_ORIGINS to the deployed frontend URL.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Routers
# -----------------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


# -----------------------------------------------------------------------------
# Health check
# -----------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """
    System health check endpoint.

    Returns:
      - Application name and version
      - Overall status: "ok" if all systems healthy, "degraded" if any fails
      - Database connectivity status
      - ML model availability

    The database check executes a trivial SELECT 1 query to confirm the
    SQLite file is reachable and not locked.

    A "degraded" status does not take the app offline — it signals that
    one or more subsystems need attention. Prediction endpoints will return
    HTTP 503 if ML models are not loaded.
    """
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
