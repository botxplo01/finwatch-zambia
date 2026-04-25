# =============================================================================
# FinWatch Zambia — Database Engine and Session
#
# Provides:
#   engine               — SQLAlchemy engine (singleton)
#   SessionLocal         — session factory for per-request sessions
#   Base                 — declarative base all ORM models inherit from
#   check_db_connection  — health check utility used by /health endpoint
# =============================================================================

import logging

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# Engine
# =============================================================================

# Use the effective URL (switches between SQLite and Postgres)
db_url = settings.effective_database_url
is_sqlite = db_url.startswith("sqlite")

# SQLite specific connection arguments (prohibited in PostgreSQL)
connect_args = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=settings.DEBUG,
    # pool_pre_ping: test connections before use to detect stale connections.
    pool_pre_ping=True,
    # Apply pooling only for PostgreSQL (non-sqlite)
    **(
        {} if is_sqlite else {
            "pool_size": 5,
            "max_overflow": 10,
            "pool_timeout": 30,
        }
    )
)


# =============================================================================
# SQLite WAL Mode
#
# WAL (Write-Ahead Logging) is SQLite's best concurrency mode for web apps.
# It allows concurrent readers while a write is in progress, eliminating
# the "database is locked" errors that occur under the default journal mode
# when FastAPI handles simultaneous requests.
#
# Also sets:
#   PRAGMA foreign_keys = ON  — enforce FK constraints (SQLite ignores them
#                               by default, which would silently break our
#                               cascade deletes and referential integrity).
#   PRAGMA synchronous = NORMAL — safe performance compromise between FULL
#                                 (slowest) and OFF (data loss on crash).
# =============================================================================


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """
    Apply SQLite PRAGMAs on every new connection.
    Only activates when using the sqlite driver.
    """
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.close()


# =============================================================================
# Session factory
# =============================================================================

SessionLocal = sessionmaker(
    bind=engine,
    # autocommit=False: all writes must be explicitly committed.
    # This gives routes full control over transaction boundaries and
    # ensures partial writes are never accidentally persisted.
    autocommit=False,
    # autoflush=False: prevents SQLAlchemy from issuing implicit SQL
    # before a query. Without this, accessing a relationship after
    # adding an object to the session could trigger an unintended flush.
    autoflush=False,
)


# =============================================================================
# Declarative base
# All ORM models (User, Company, FinancialRecord, etc.) inherit from Base.
# Base.metadata holds the full table registry used by Alembic and init_db.
# =============================================================================


class Base(DeclarativeBase):
    pass


# =============================================================================
# Health check
# =============================================================================


def check_db_connection() -> bool:
    """
    Verify that the database is reachable by executing a trivial query.

    Used by the GET /health endpoint in main.py to include database
    connectivity in the health response. Returns True if the connection
    succeeds, False if the database is unavailable or locked.

    Does not raise — callers should treat False as a degraded health state.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except OperationalError as exc:
        logger.error("Database health check failed: %s", exc)
        return False
