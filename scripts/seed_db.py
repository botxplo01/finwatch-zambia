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
                business_scale="medium_scale",
                onboarding_complete=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created SME User: david@test.zm")

        # 2. Create Sample Company 1 (Healthy)
        company1 = (
            db.query(Company).filter(Company.name == "Lusaka Solar Solutions").first()
        )
        if not company1:
            company1 = Company(
                name="Lusaka Solar Solutions",
                owner_id=user.id,
                industry="Energy",
                registration_number="SOL-2026-ZM",
            )
            db.add(company1)
            db.commit()
            db.refresh(company1)
            print(f"Created Company: {company1.name}")

        # 3. Create a historic financial record for Company 1
        record1 = FinancialRecord(
            company_id=company1.id,
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
        db.add(record1)

        # 4. Create Sample Company 2 (Distressed)
        company2 = (
            db.query(Company).filter(Company.name == "Copperbelt Logistics").first()
        )
        if not company2:
            company2 = Company(
                name="Copperbelt Logistics",
                owner_id=user.id,
                industry="Transport",
                registration_number="LOG-2026-ZM",
            )
            db.add(company2)
            db.commit()
            db.refresh(company2)
            print(f"Created Company: {company2.name}")

        # 5. Create a historic financial record for Company 2 (Distressed Indicators)
        record2 = FinancialRecord(
            company_id=company2.id,
            period="2025-Q1",
            total_assets=100000.0,
            current_assets=20000.0,
            current_liabilities=50000.0,  # High current debt
            total_liabilities=95000.0,  # Near insolvency
            revenue=80000.0,
            net_income=-15000.0,  # Negative profit
            inventory=15000.0,
            cash_and_equivalents=1000.0,  # Very low liquidity
            retained_earnings=-5000.0,
            ebit=-12000.0,
            interest_expense=3000.0,
            total_equity=5000.0,
        )
        db.add(record2)

        db.commit()
        print("Created sample financial history for multiple companies.")

    finally:
        db.close()

        db.close()


if __name__ == "__main__":
    seed()
