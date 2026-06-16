"""
FinWatch Zambia - FastAPI Application Entry Point

Run: uvicorn app.main:app --reload --port 8000
API Documentation: http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    admin,
    auth,
    chat,
    companies,
    conversations,
    docs_chat,
    institutional,
    institutional_chat,
    predictions,
    qr_auth,
    reports,
)
from app.core.config import settings
from app.db.database import check_db_connection
from app.db.init_db import init_db
from app.services.ml_service import load_models
from app.services.shap_service import load_explainers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database, ML models, and SHAP explainers on startup."""
    init_db()
    load_models()
    load_explainers()

    # Log status of API keys
    if settings.GROQ_API_KEY:
        logger.info("NLP Service: Groq API configured (Primary)")
    else:
        logger.warning(
            "NLP Service: Groq API key missing (attempting OpenRouter or Template Engine fallback)"
        )

    if settings.EXTRACTION_GROQ_API_KEY:
        logger.info("Extraction Service: Dedicated Groq API configured")
    else:
        logger.warning(
            "Extraction Service: Dedicated Groq API key missing (using NLP key or falling back)"
        )

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

# Mount static files for profile pictures
app.mount(
    "/static",
    StaticFiles(directory=str(settings.profile_pictures_path.parent)),
    name="static",
)
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(qr_auth.router, prefix="/api/auth/qr", tags=["QR Authentication"])
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(
    docs_chat.router, prefix="/api/docs", tags=["Documentation Assistant"]
)
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Institutional Portal Routes
app.include_router(
    institutional.router, prefix="/api/institutional", tags=["Institutional"]
)
app.include_router(
    institutional_chat.router,
    prefix="/api/institutional/chat",
    tags=["Institutional Chat"],
)
app.include_router(
    conversations.router,
    prefix="/api/conversations",
    tags=["conversations"],
)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint verifying database and ML model availability."""
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
