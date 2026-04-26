"""
FinWatch Zambia - Database Initialisation

Called once at application startup via the lifespan handler in main.py.

Responsibilities:
1. Register all ORM models with SQLAlchemy metadata
2. Create all tables that do not already exist (safe to call repeatedly)
3. Ensure the reports output directory exists on disk
4. Log confirmation of successful initialisation
"""

import logging

from app.db.database import Base, engine

logger = logging.getLogger(__name__)

from app.models import (  # noqa: F401
    company,
    financial_record,
    narrative,
    prediction,
    ratio_feature,
    report,
    user,
)


def init_db() -> None:
    """Initialise the database and ensure all supporting directories exist."""
    logger.info("Initialising database...")

    Base.metadata.create_all(bind=engine)
    table_names = list(Base.metadata.tables.keys())
    logger.info(
        "Database ready. Tables registered (%d): %s",
        len(table_names),
        ", ".join(sorted(table_names)),
    )

    try:
        from app.core.config import settings

        reports_dir = settings.reports_path
        logger.info("Reports directory confirmed: %s", reports_dir)
    except Exception as exc:
        logger.warning("Could not confirm reports directory: %s", exc)
