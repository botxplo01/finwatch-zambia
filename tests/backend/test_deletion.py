import pytest
from fastapi import status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.company import Company
from app.core.security import create_access_token

@pytest.mark.anyio
def test_delete_account_success(client, db: Session, sme_user):
    """Test that a user can delete their own account and all data is removed."""
    # 1. Add some data for the user
    company = Company(name="Test SME", owner_id=sme_user.id, industry="Tech")
    db.add(company)
    db.commit()
    
    # Verify data exists
    assert db.query(User).filter(User.id == sme_user.id).first() is not None
    assert db.query(Company).filter(Company.owner_id == sme_user.id).count() == 1
    
    # 2. Delete account
    token = create_access_token(sme_user.id)
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.delete("/api/auth/me", headers=headers)
    
    assert response.status_code == status.HTTP_204_NO_CONTENT
    
    # 3. Verify user and data are gone
    db.expire_all() # Ensure we're not seeing cached objects
    assert db.query(User).filter(User.id == sme_user.id).first() is None
    assert db.query(Company).filter(Company.owner_id == sme_user.id).count() == 0

@pytest.mark.anyio
def test_delete_account_unauthorized(client):
    """Test that deletion requires authentication."""
    response = client.delete("/api/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
