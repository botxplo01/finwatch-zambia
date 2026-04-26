"""
FinWatch Zambia - Database Engine and Session

Provides:
- engine: SQLAlchemy engine (singleton)
- SessionLocal: Session factory for per-request sessions
- Base: Declarative base all ORM models inherit from
- check_db_connection: Health check utility used by /health endpoint
"""

import logging

from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)


db_url = settings.effective_database_url
is_sqlite = db_url.startswith("sqlite")

connect_args = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    **(
        {} if is_sqlite else {
            "pool_size": 5,
            "max_overflow": 10,
            "pool_timeout": 30,
        }
    )
)




@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """Apply SQLite PRAGMAs on every new connection."""
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.close()



SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)




class Base(DeclarativeBase):
    pass




def check_db_connection() -> bool:
    """Verify that the database is reachable by executing a trivial query."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except OperationalError as exc:
        logger.error("Database health check failed: %s", exc)
        return False
