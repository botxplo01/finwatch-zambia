"""
FinWatch Zambia - Database Initialisation

Initialises database tables and verifies filesystem requirements during startup lifespan.
"""

import logging

from app.db.database import Base, engine

logger = logging.getLogger(__name__)

from app.models import (  # noqa: F401
    ai_usage_log,
    company,
    financial_record,
    narrative,
    prediction,
    ratio_feature,
    report,
    user,
    user_device_session,
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
