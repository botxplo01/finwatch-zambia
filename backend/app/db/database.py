# =============================================================================
# FinWatch Zambia — Database Engine and Session
# =============================================================================

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# -----------------------------------------------------------------------------
# Engine
# SQLite-specific: check_same_thread=False is required because FastAPI
# runs multiple threads. This is safe with SQLAlchemy's session management.
# -----------------------------------------------------------------------------
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,  # Log SQL statements in debug mode
)

# -----------------------------------------------------------------------------
# Session factory
# autocommit=False: transactions must be explicitly committed
# autoflush=False: prevents premature flushes before commit
# -----------------------------------------------------------------------------
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# -----------------------------------------------------------------------------
# Declarative base — all ORM models inherit from this
# -----------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass
