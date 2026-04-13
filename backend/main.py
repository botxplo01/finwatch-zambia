# =============================================================================
# FinWatch Zambia — FastAPI Application Entry Point
# Run: uvicorn main:app --reload --port 8000
# Docs: http://localhost:8000/docs
# =============================================================================

from contextlib import asynccontextmanager

from app.api import admin, auth, companies, predictions, reports
from app.core.config import settings
from app.db.database import engine
from app.db.init_db import init_db
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Runs startup logic before the app begins serving requests,
    and teardown logic when the app shuts down.
    """
    # Startup
    init_db()
    yield
    # Shutdown (add cleanup here if needed)


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
    Simple health check endpoint.
    Returns application name, version, and status.
    """
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
