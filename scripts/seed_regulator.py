# =============================================================================
# scripts/seed_regulator.py — Create regulator data for demonstration
# =============================================================================

import sys
from pathlib import Path

# Add backend to path
_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(_BACKEND_DIR))

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def seed():
    db = SessionLocal()
    try:
        # 1. Create Regulator User
        regulator = db.query(User).filter(User.email == "regulator@finwatch.zm").first()
        if not regulator:
            regulator = User(
                full_name="National Regulator",
                email="regulator@finwatch.zm",
                hashed_password=hash_password("admin123"),
                role="regulator"
            )
            db.add(regulator)
            db.commit()
            print("Created Regulator User: regulator@finwatch.zm")

        # 2. Create Policy Analyst
        analyst = db.query(User).filter(User.email == "analyst@finwatch.zm").first()
        if not analyst:
            analyst = User(
                full_name="Senior Policy Analyst",
                email="analyst@finwatch.zm",
                hashed_password=hash_password("analyst123"),
                role="policy_analyst"
            )
            db.add(analyst)
            db.commit()
            print("Created Analyst User: analyst@finwatch.zm")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
