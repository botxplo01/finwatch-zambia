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

# Absolute path to the backend/ directory — used to resolve relative paths
# regardless of where uvicorn is invoked from.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """
    Central settings object. Values are read from environment variables
    or the .env file in the backend/ directory. Pydantic validates all
    types at startup — misconfigured environments fail fast and loudly.
    """

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
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
    SECRET_KEY: str  # Required — no default. Must be set in .env.
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        """
        Prevent the application from starting with a blank or
        placeholder SECRET_KEY. A real key must be at least 32
        hex characters (produced by secrets.token_hex(32)).
        """
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
    # Groq API — Primary NLP
    # -------------------------------------------------------------------------
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # -------------------------------------------------------------------------
    # Ollama — Local NLP Fallback
    # -------------------------------------------------------------------------
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"

    # -------------------------------------------------------------------------
    # NLP Service
    # -------------------------------------------------------------------------
    NLP_PRIMARY: str = "groq"  # groq | ollama | template
    NLP_FALLBACK: str = "ollama"  # ollama | template
    NLP_TEMPERATURE: float = 0.2
    NLP_MAX_TOKENS: int = 350

    # -------------------------------------------------------------------------
    # ML Pipeline
    # Path where serialized model artifacts are stored after training.
    # Relative paths are resolved from the backend/ directory.
    # -------------------------------------------------------------------------
    ML_ARTIFACTS_DIR: str = "ml/artifacts"

    @property
    def ml_artifacts_path(self) -> Path:
        """Resolved absolute path to the ML artifacts directory."""
        p = Path(self.ML_ARTIFACTS_DIR)
        return p if p.is_absolute() else _BACKEND_DIR / p

    # -------------------------------------------------------------------------
    # Reports
    # Directory where generated PDF reports are written.
    # Created automatically at startup if it does not exist.
    # -------------------------------------------------------------------------
    REPORTS_DIR: str = "reports"

    @property
    def reports_path(self) -> Path:
        """Resolved absolute path to the reports output directory."""
        p = Path(self.REPORTS_DIR)
        resolved = p if p.is_absolute() else _BACKEND_DIR / p
        resolved.mkdir(parents=True, exist_ok=True)
        return resolved


# Singleton instance — import this everywhere
settings = Settings()
