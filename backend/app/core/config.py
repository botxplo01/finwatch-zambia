"""
FinWatch Zambia - Application Configuration

Centralizes all environment settings and application configurations.
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

    APP_NAME: str = "FinWatch Zambia"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS_RAW: str = (
        "http://localhost,https://localhost,capacitor://localhost,http://localhost:3000,http://localhost:8000,https://finwatch-backend.onrender.com,https://finwatch-zambia.vercel.app,https://finwatch-zambia-frontend.vercel.app"
    )

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        return [s.strip() for s in self.ALLOWED_ORIGINS_RAW.split(",") if s.strip()]

    RENDER: bool = False

    DATABASE_URL: str = "sqlite:///./finwatch.db"
    SUPABASE_DB_URL: str | None = None

    @property
    def effective_database_url(self) -> str:
        """Dynamically resolves the active database connection string."""
        if self.RENDER and self.SUPABASE_DB_URL:
            url = self.SUPABASE_DB_URL.strip()
            if "://" not in url and "//" in url:
                url = url.replace("//", "://", 1)
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        return self.DATABASE_URL

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    LONG_SESSION_EXPIRE_MINUTES: int = 60 * 24 * 30
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

    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    FROM_EMAIL: str = "FinWatch Zambia <onboarding@finwatch.zm>"

    RESEND_API_KEY: str = ""
    EMAIL_BRIDGE_URL: str = ""

    GOV_EMAIL_CODE: str = "21435"
    DEMO_EMAIL_CODE: str = "52143"

    RESTRICTED_INDUSTRIES: list[str] = ["Financial Services", "Healthcare", "Mining"]

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    EXTRACTION_GROQ_API_KEY: str = ""
    EXTRACTION_GROQ_MODEL: str = "openai/gpt-oss-20b"

    DOCS_GROQ_API_KEY: str = ""

    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    NLP_PRIMARY: str = "groq"
    NLP_TEMPERATURE: float = 0.2
    NLP_MAX_TOKENS: int = 1500

    BRAND_LOGO_PATH: str = "app/static/brand/FinWatch_Logo_Report.png"

    @property
    def brand_logo_absolute_path(self) -> Path:
        p = Path(self.BRAND_LOGO_PATH)
        return p if p.is_absolute() else _BACKEND_DIR / p

    ML_ARTIFACTS_DIR: str = "ml/artifacts"

    @property
    def ml_artifacts_path(self) -> Path:
        p = Path(self.ML_ARTIFACTS_DIR)
        return p if p.is_absolute() else _BACKEND_DIR / p

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
