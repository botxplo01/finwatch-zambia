# =============================================================================
# FinWatch Zambia — Database Initialisation
#
# Called once at application startup via the lifespan handler in main.py.
#
# Responsibilities:
#   1. Register all ORM models with SQLAlchemy metadata
#   2. Create all tables that do not already exist (safe to call repeatedly)
#   3. Ensure the reports output directory exists on disk
#   4. Log confirmation of successful initialisation
# =============================================================================

import logging

from app.db.database import Base, engine

logger = logging.getLogger(__name__)

# =============================================================================
# Model registration
#
# All ORM model modules must be imported here — even if unused directly —
# so that SQLAlchemy's metadata registry is fully populated before
# Base.metadata.create_all() is called. Missing an import here means the
# corresponding table will not be created on first run.
# =============================================================================
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
    """
    Initialise the database and ensure all supporting directories exist.

    Table creation is idempotent — SQLAlchemy checks whether each table
    exists before issuing a CREATE TABLE statement, so calling this on
    every startup is safe and has no effect on existing data.

    Also ensures the reports output directory exists so the first PDF
    generation request does not fail due to a missing path.
    """
    logger.info("Initialising database...")

    # Create all tables defined across registered ORM models
    Base.metadata.create_all(bind=engine)

    # Log which tables are now registered (useful for development verification)
    table_names = list(Base.metadata.tables.keys())
    logger.info(
        "Database ready. Tables registered (%d): %s",
        len(table_names),
        ", ".join(sorted(table_names)),
    )

    # Ensure the reports directory exists at startup
    # settings.reports_path is a @property that calls mkdir(exist_ok=True)
    try:
        from app.core.config import settings

        reports_dir = settings.reports_path
        logger.info("Reports directory confirmed: %s", reports_dir)
    except Exception as exc:
        # Non-fatal — log the warning but do not prevent the app from starting
        logger.warning("Could not confirm reports directory: %s", exc)
