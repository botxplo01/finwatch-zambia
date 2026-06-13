"""
FinWatch Zambia - Application Configuration

All settings are loaded from environment variables or .env file.

Usage:
    from app.core.config import settings

Generate a secure SECRET_KEY:
    python -c "import secrets; print(secrets.token_hex(32))"
"""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "FinWatch Zambia"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS_RAW: str = (
        "http://localhost,https://localhost,capacitor://localhost,http://localhost:3000,http://localhost:8000,https://finwatch-backend.onrender.com,https://finwatch-zambia.vercel.app,https://finwatch-zambia-frontend.vercel.app"
    )

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return [s.strip() for s in self.ALLOWED_ORIGINS_RAW.split(",") if s.strip()]

    # Environment Detection
    RENDER: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./finwatch.db"
    SUPABASE_DB_URL: str | None = None

    @property
    def effective_database_url(self) -> str:
        """Automatically switch between Supabase (production) and SQLite (local)."""
        if self.RENDER and self.SUPABASE_DB_URL:
            url = self.SUPABASE_DB_URL.strip()
            if "://" not in url and "//" in url:
                url = url.replace("//", "://", 1)
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        return self.DATABASE_URL

    # JWT Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for standard web sessions
    LONG_SESSION_EXPIRE_MINUTES: int = (
        60 * 24 * 30
    )  # 30 days for persistent mobile sessions
    REGULATOR_INVITATION_CODE: str = "FINWATCH-2026"

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

    # Email (SMTP - Gmail)
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""  # Your gmail address
    EMAIL_PASSWORD: str = ""  # Your 16-character App Password
    FROM_EMAIL: str = "FinWatch Zambia <onboarding@finwatch.zm>"

    # Email API (Fallback/Production - Resend)
    RESEND_API_KEY: str = ""

    # HTTP Email Bridge (For Render/Cloud - No SMTP)
    # Use a Google Apps Script URL here to bypass SMTP port blocks for free.
    EMAIL_BRIDGE_URL: str = ""

    # Environment Locks (Demo)
    GOV_EMAIL_CODE: str = "21435"
    DEMO_EMAIL_CODE: str = "52143"

    # Industry Constraints
    RESTRICTED_INDUSTRIES: list[str] = ["Financial Services", "Healthcare", "Mining"]

    # Groq API - Primary NLP
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Groq API - Dedicated Data Extraction
    EXTRACTION_GROQ_API_KEY: str = ""
    EXTRACTION_GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Groq API - Dedicated Documentation Assistant
    DOCS_GROQ_API_KEY: str = ""

    # OpenRouter API — Used when Groq is blocked by cloud provider IP policy
    # Free tier available at https://openrouter.ai — same llama model, different infra
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # NLP Service
    NLP_PRIMARY: str = "groq"
    NLP_TEMPERATURE: float = 0.2
    NLP_MAX_TOKENS: int = 1500

    # Branding
    BRAND_LOGO_PATH: str = "frontend/public/brand/FinWatch_Logo_Report.png"

    @property
    def brand_logo_absolute_path(self) -> Path:
        p = Path(self.BRAND_LOGO_PATH)
        return p if p.is_absolute() else _ROOT_DIR / p

    # ML Pipeline
    ML_ARTIFACTS_DIR: str = "ml/artifacts"

    @property
    def ml_artifacts_path(self) -> Path:
        p = Path(self.ML_ARTIFACTS_DIR)
        return p if p.is_absolute() else _BACKEND_DIR / p

    # Reports
    REPORTS_DIR: str = "reports"
    PROFILE_PICTURES_DIR: str = "app/static/profile_pictures"

    @property
    def reports_path(self) -> Path:
        p = Path(self.REPORTS_DIR)
        resolved = p if p.is_absolute() else _BACKEND_DIR / p
        resolved.mkdir(parents=True, exist_ok=True)
        return resolved

    @property
    def profile_pictures_path(self) -> Path:
        p = Path(self.PROFILE_PICTURES_DIR)
        resolved = p if p.is_absolute() else _BACKEND_DIR / p
        resolved.mkdir(parents=True, exist_ok=True)
        return resolved


settings = Settings()
