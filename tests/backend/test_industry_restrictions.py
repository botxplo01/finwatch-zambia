import pytest
from app.main import app
from app.core.dependencies import get_current_sme_user

def test_create_company_restricted_industry_small_scale(client, db, sme_user, sme_headers):
    """
    Test that a Small Scale user cannot create a company in a restricted industry.
    """
    app.dependency_overrides[get_current_sme_user] = lambda: sme_user
    
    try:
        sme_user.business_scale = "small_scale"
        db.commit()

        payload = {
            "name": "Restricted Healthcare SME",
            "industry": "Healthcare",
            "registration_number": "123456789012",
        }
        
        res = client.post("/api/companies/", json=payload, headers=sme_headers)
        assert res.status_code == 400
        assert "restricted to Medium Scale businesses" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_create_company_allowed_industry_small_scale(client, db, sme_user, sme_headers):
    """
    Test that a Small Scale user can create a company in an allowed industry.
    """
    app.dependency_overrides[get_current_sme_user] = lambda: sme_user
    
    try:
        sme_user.business_scale = "small_scale"
        db.commit()

        payload = {
            "name": "Allowed Agriculture SME",
            "industry": "Agriculture",
            "registration_number": "987654321098",
        }
        
        res = client.post("/api/companies/", json=payload, headers=sme_headers)
        assert res.status_code == 201
    finally:
        app.dependency_overrides.clear()

def test_create_company_restricted_industry_medium_scale(client, db, sme_user, sme_headers):
    """
    Test that a Medium Scale user can create a company in a restricted industry.
    """
    app.dependency_overrides[get_current_sme_user] = lambda: sme_user
    
    try:
        sme_user.business_scale = "medium_scale"
        db.commit()

        payload = {
            "name": "Valid Healthcare SME",
            "industry": "Healthcare",
            "registration_number": "112233445566",
        }
        
        res = client.post("/api/companies/", json=payload, headers=sme_headers)
        assert res.status_code == 201
    finally:
        app.dependency_overrides.clear()

def test_grandfathering_patch_success(client, db, sme_user, sme_headers):
    """
    Test that a Small Scale user can update non-industry fields 
    for a grandfathered restricted company.
    """
    app.dependency_overrides[get_current_sme_user] = lambda: sme_user
    try:
        # Create a restricted company as Medium Scale
        sme_user.business_scale = "medium_scale"
        db.commit()
        
        c_res = client.post("/api/companies/", json={
            "name": "Legacy Healthcare",
            "industry": "Healthcare"
        }, headers=sme_headers)
        company_id = c_res.json()["id"]
        
        # Change user to Small Scale
        sme_user.business_scale = "small_scale"
        db.commit()
        
        # Attempt to update description (should succeed)
        res = client.patch(f"/api/companies/{company_id}", json={
            "description": "Updated legacy description"
        }, headers=sme_headers)
        
        assert res.status_code == 200
        assert res.json()["description"] == "Updated legacy description"
        assert res.json()["industry"] == "Healthcare" # Industry preserved
    finally:
        app.dependency_overrides.clear()

def test_blocked_transition_patch_fails(client, db, sme_user, sme_headers):
    """
    Test that a Small Scale user cannot change an allowed industry 
    to a restricted one.
    """
    app.dependency_overrides[get_current_sme_user] = lambda: sme_user
    try:
        sme_user.business_scale = "small_scale"
        db.commit()
        
        c_res = client.post("/api/companies/", json={
            "name": "Normal SME",
            "industry": "Agriculture"
        }, headers=sme_headers)
        company_id = c_res.json()["id"]
        
        # Attempt to change to Mining (should fail)
        res = client.patch(f"/api/companies/{company_id}", json={
            "industry": "Mining"
        }, headers=sme_headers)
        
        assert res.status_code == 400
        assert "restricted to Medium Scale businesses" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()
