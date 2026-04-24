# =============================================================================
# FinWatch Zambia — Application Configuration
# All settings are loaded from environment variables / .env file.
#
# Usage:
#   from app.core.config import settings
#
# Generate a secure SECRET_KEY:
#   python -c "import secrets; print(secrets.token_hex(32))"
# =============================================================================

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    APP_NAME: str = "FinWatch Zambia"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    # -------------------------------------------------------------------------
    # Database
    # -------------------------------------------------------------------------
    DATABASE_URL: str = "sqlite:///./finwatch.db"

    # -------------------------------------------------------------------------
    # JWT Authentication
    # -------------------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError(
                "SECRET_KEY is not set. "
                'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
            )
        if stripped in (
            "your_strong_random_secret_key_here",
            "changeme",
            "secret",
            "replace_me",
        ):
            raise ValueError(
                "SECRET_KEY is still a placeholder. "
                "Replace it with a real key in your .env file."
            )
        if len(stripped) < 32:
            raise ValueError(
                f"SECRET_KEY is too short ({len(stripped)} chars). "
                "Use at least 32 characters for adequate security."
            )
        return stripped

    # -------------------------------------------------------------------------
    # Groq API — Tier 1 NLP
    # -------------------------------------------------------------------------
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # -------------------------------------------------------------------------
    # Ollama Local — Tiers 2 & 3 NLP
    # Primary: granite4:3b  (IBM enterprise model, efficient on i7 8th Gen)
    # Fallback: gemma3:1b   (Google lightweight model, last local resort)
    # -------------------------------------------------------------------------
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_LOCAL_MODEL_PRIMARY: str = "granite4:3b"
    OLLAMA_LOCAL_MODEL_FALLBACK: str = "gemma3:1b"

    # Kept for backward compatibility — not used directly by nlp_service.py
    OLLAMA_MODEL: str = "granite4:3b"

    # -------------------------------------------------------------------------
    # NLP Service
    # -------------------------------------------------------------------------
    NLP_PRIMARY: str = "groq"
    NLP_FALLBACK: str = "ollama"
    NLP_TEMPERATURE: float = 0.2
    NLP_MAX_TOKENS: int = 350

    # -------------------------------------------------------------------------
    # ML Pipeline
    # -------------------------------------------------------------------------
    ML_ARTIFACTS_DIR: str = "ml/artifacts"

    @property
    def ml_artifacts_path(self) -> Path:
        p = Path(self.ML_ARTIFACTS_DIR)
        return p if p.is_absolute() else _BACKEND_DIR / p

    # -------------------------------------------------------------------------
    # Reports
    # -------------------------------------------------------------------------
    REPORTS_DIR: str = "reports"

    @property
    def reports_path(self) -> Path:
        p = Path(self.REPORTS_DIR)
        resolved = p if p.is_absolute() else _BACKEND_DIR / p
        resolved.mkdir(parents=True, exist_ok=True)
        return resolved


settings = Settings()
