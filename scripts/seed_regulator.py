import sys
from pathlib import Path

# Add backend/ to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_dir))

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def seed_regulator():
    db = SessionLocal()
    try:
        # Check if regulator already exists
        email = "regulator@finwatch.zm"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"Regulator {email} already exists.")
        else:
            user = User(
                full_name="System Regulator",
                email=email,
                hashed_password=hash_password("regulator123"),
                role="regulator",
                is_active=True,
                is_admin=True
            )
            db.add(user)
            db.commit()
            print(f"Regulator {email} created successfully.")
        
        # Also create a policy analyst
        email_pa = "analyst@finwatch.zm"
        existing_pa = db.query(User).filter(User.email == email_pa).first()
        if not existing_pa:
            user_pa = User(
                full_name="Policy Analyst",
                email=email_pa,
                hashed_password=hash_password("analyst123"),
                role="policy_analyst",
                is_active=True,
                is_admin=False
            )
            db.add(user_pa)
            db.commit()
            print(f"Policy Analyst {email_pa} created successfully.")
            
        # Create a standard SME owner for testing redirects
        email_sme = "sme@finwatch.zm"
        existing_sme = db.query(User).filter(User.email == email_sme).first()
        if not existing_sme:
            user_sme = User(
                full_name="SME Owner",
                email=email_sme,
                hashed_password=hash_password("sme123"),
                role="sme_owner",
                is_active=True,
                is_admin=False
            )
            db.add(user_sme)
            db.commit()
            print(f"SME Owner {email_sme} created successfully.")

    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_regulator()
