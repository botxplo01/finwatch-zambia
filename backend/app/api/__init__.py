# =============================================================================
# FinWatch Zambia — API Package
# All routers are registered in backend/main.py via include_router().
# =============================================================================

from app.api import admin, auth, companies, predictions, reports

__all__ = ["auth", "companies", "predictions", "reports", "admin"]
