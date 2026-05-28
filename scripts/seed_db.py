# FinWatch Zambia - Create sample SME data for demonstration

import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(_BACKEND_DIR))

from app.core.security import hash_password
from app.db.database import SessionLocal
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.user import User


def seed():
    db = SessionLocal()
    try:
        # 1. Create SME User
        user = db.query(User).filter(User.email == "david@test.zm").first()
        if not user:
            user = User(
                full_name="David SME Owner",
                title="Mr.",
                email="david@test.zm",
                hashed_password=hash_password("password123"),
                role="sme_owner",
                portal_type="sme",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created SME User: david@test.zm")

        # 2. Create Sample Company
        company = (
            db.query(Company).filter(Company.name == "Lusaka Solar Solutions").first()
        )
        if not company:
            company = Company(
                name="Lusaka Solar Solutions",
                owner_id=user.id,
                industry="Energy",
                registration_number="SOL-2026-ZM",
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f"Created Company: {company.name}")

        # 3. Create a historic financial record
        record = FinancialRecord(
            company_id=company.id,
            period="2025-Q1",
            total_assets=150000.0,
            current_assets=45000.0,
            current_liabilities=30000.0,
            total_liabilities=80000.0,
            revenue=200000.0,
            net_income=15000.0,
            inventory=5000.0,
            cash_and_equivalents=12000.0,
            retained_earnings=20000.0,
            ebit=20000.0,
            interest_expense=2000.0,
            total_equity=70000.0,
        )

        db.add(record)
        db.commit()
        print("Created sample financial history.")

    finally:
        db.close()

        db.close()


if __name__ == "__main__":
    seed()
