# =============================================================================
# FinWatch Zambia — Application Configuration
# All settings are loaded from environment variables / .env file.
# =============================================================================

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central settings object. Values are read from environment variables
    or the .env file in the project root. Pydantic validates types
    automatically — misconfigured environments fail fast at startup.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
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
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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


# Singleton instance — import this everywhere
settings = Settings()
