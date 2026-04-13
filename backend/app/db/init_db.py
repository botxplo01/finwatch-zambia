# =============================================================================
# FinWatch Zambia — Database Initialisation
# Called at application startup via the lifespan handler in main.py.
# Creates all tables defined in ORM models if they do not already exist.
# =============================================================================

from app.db.database import Base, engine

# Import all models so SQLAlchemy's metadata is aware of them
# before Base.metadata.create_all() is called.
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
    Create all database tables based on registered ORM models.
    Safe to call on every startup — skips tables that already exist.
    """
    Base.metadata.create_all(bind=engine)
