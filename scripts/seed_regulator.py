# FinWatch Zambia - Create regulator data for demonstration

import sys
from pathlib import Path

# Add backend to path
_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(_BACKEND_DIR))

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.user import User


def seed():
    db = SessionLocal()
    try:
        # 1. Create Regulator User
        regulator = db.query(User).filter(User.email == "regulator@finwatch.zm").first()
        if not regulator:
            regulator = User(
                full_name="National Regulator",
                title="Mr.",
                email="regulator@finwatch.zm",
                hashed_password=hash_password("admin123"),
                role="regulator",
                portal_type="institutional",
            )
            db.add(regulator)
            db.commit()
            print("Created Regulator User: regulator@finwatch.zm")

        # 2. Create Policy Analyst
        analyst = db.query(User).filter(User.email == "analyst@finwatch.zm").first()
        if not analyst:
            analyst = User(
                full_name="Senior Policy Analyst",
                title="Dr.",
                email="analyst@finwatch.zm",
                hashed_password=hash_password("analyst123"),
                role="policy_analyst",
                portal_type="institutional",
            )
            db.add(analyst)
            db.commit()
            print("Created Analyst User: analyst@finwatch.zm")

    finally:
        db.close()

        db.close()

if __name__ == "__main__":
    seed()
