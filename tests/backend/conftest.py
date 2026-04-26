"""
FinWatch Zambia — Test Configuration & Shared Fixtures

Provides:
    - In-memory SQLite test database (isolated per test session)
    - FastAPI test client with dependency overrides
    - Pre-registered SME user and regulator user fixtures
    - Auth token helpers
    - Simulated ML models and SHAP explainers for testing
    - Sample financial data constants
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token, hash_password
from app.db.database import Base
from app.core.dependencies import get_db
from app.main import app
from app.models.company import Company
from app.models.financial_record import FinancialRecord
from app.models.narrative import Narrative
from app.models.prediction import Prediction
from app.models.ratio_feature import RatioFeature
from app.models.user import User

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """
    Provide a clean database session per test.
    Rolls back all changes after each test for isolation.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    """
    FastAPI test client with the database dependency overridden
    to use the isolated test session.
    """
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# Sample Financial Data

HEALTHY_FINANCIALS = {
    "period": "2024-Q4",
    "current_assets": 500_000.0,
    "current_liabilities": 200_000.0,
    "total_assets": 1_200_000.0,
    "total_liabilities": 400_000.0,
    "total_equity": 800_000.0,
    "inventory": 100_000.0,
    "cash_and_equivalents": 150_000.0,
    "retained_earnings": 300_000.0,
    "revenue": 600_000.0,
    "net_income": 120_000.0,
    "ebit": 180_000.0,
    "interest_expense": 20_000.0,
}

DISTRESSED_FINANCIALS = {
    "period": "2024-Q4",
    "current_assets": 80_000.0,
    "current_liabilities": 200_000.0,
    "total_assets": 500_000.0,
    "total_liabilities": 420_000.0,
    "total_equity": 80_000.0,
    "inventory": 50_000.0,
    "cash_and_equivalents": 10_000.0,
    "retained_earnings": -50_000.0,
    "revenue": 150_000.0,
    "net_income": -80_000.0,
    "ebit": -30_000.0,
    "interest_expense": 50_000.0,
}

SAMPLE_RATIOS = {
    "current_ratio": 2.5,
    "quick_ratio": 2.0,
    "cash_ratio": 0.75,
    "debt_to_equity": 0.5,
    "debt_to_assets": 0.333,
    "interest_coverage": 9.0,
    "net_profit_margin": 0.2,
    "return_on_assets": 0.1,
    "return_on_equity": 0.15,
    "asset_turnover": 0.5,
}

SAMPLE_SHAP = {
    "current_ratio": -0.12,
    "quick_ratio": -0.08,
    "cash_ratio": -0.05,
    "debt_to_equity": 0.03,
    "debt_to_assets": 0.02,
    "interest_coverage": -0.09,
    "net_profit_margin": -0.07,
    "return_on_assets": -0.04,
    "return_on_equity": -0.03,
    "asset_turnover": -0.01,
}


@pytest.fixture
def sme_user(db):
    """Create and return a registered SME owner user."""
    user = User(
        full_name="Test SME Owner",
        email="sme@test.com",
        hashed_password=hash_password("TestPassword123!"),
        is_active=True,
        role="sme_owner",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def regulator_user(db):
    """Create and return a full regulator user."""
    user = User(
        full_name="Test Regulator",
        email="regulator@test.com",
        hashed_password=hash_password("RegPassword123!"),
        is_active=True,
        role="regulator",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def policy_analyst_user(db):
    """Create and return a policy analyst user."""
    user = User(
        full_name="Test Analyst",
        email="analyst@test.com",
        hashed_password=hash_password("AnalystPass123!"),
        is_active=True,
        role="policy_analyst",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def sme_token(sme_user):
    """JWT token for the SME user."""
    return create_access_token(subject=str(sme_user.id))


@pytest.fixture
def regulator_token(regulator_user):
    """JWT token for the regulator user."""
    return create_access_token(subject=str(regulator_user.id))


@pytest.fixture
def analyst_token(policy_analyst_user):
    """JWT token for the policy analyst user."""
    return create_access_token(subject=str(policy_analyst_user.id))


@pytest.fixture
def sme_headers(sme_token):
    return {"Authorization": f"Bearer {sme_token}"}


@pytest.fixture
def regulator_headers(regulator_token):
    return {"Authorization": f"Bearer {regulator_token}"}


@pytest.fixture
def analyst_headers(analyst_token):
    return {"Authorization": f"Bearer {analyst_token}"}


@pytest.fixture
def company(db, sme_user):
    """Create and return a company owned by the SME user."""
    c = Company(
        owner_id=sme_user.id,
        name="Lusaka Trading Ltd",
        industry="Retail & Trade",
        registration_number="LZ2024001",
        description="Test company",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def financial_record(db, company):
    """Create and return a financial record for the company."""
    rec = FinancialRecord(
        company_id=company.id,
        **HEALTHY_FINANCIALS,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@pytest.fixture
def ratio_feature(db, financial_record):
    """Create and return a ratio feature row for the financial record."""
    rf = RatioFeature(
        financial_record_id=financial_record.id,
        **SAMPLE_RATIOS,
    )
    db.add(rf)
    db.commit()
    db.refresh(rf)
    return rf


@pytest.fixture
def prediction_with_narrative(db, ratio_feature):
    """Create a full prediction with SHAP values and a narrative."""
    pred = Prediction(
        ratio_feature_id=ratio_feature.id,
        model_used="random_forest",
        risk_label="Healthy",
        distress_probability=0.05,
        shap_values_json=json.dumps(SAMPLE_SHAP),
        prediction_hash="abc123testhash",
    )
    db.add(pred)
    db.flush()

    narr = Narrative(
        prediction_id=pred.id,
        content="This business is financially healthy with strong liquidity ratios.",
        source="groq",
        cache_key="abc123testhash",
    )
    db.add(narr)
    db.commit()
    db.refresh(pred)
    return pred


# ML / SHAP Mock Fixtures

@pytest.fixture
def mock_models():
    """
    Patch the ML model registry so inference endpoints work
    without real trained artifacts on disk.
    """
    mock_rf = MagicMock()
    mock_rf.predict_proba.return_value = [[0.95, 0.05]]  # 5% distress

    mock_lr = MagicMock()
    mock_lr.predict_proba.return_value = [[0.80, 0.20]]  # 20% distress

    mock_scaler = MagicMock()
    mock_scaler.transform.side_effect = lambda x: x  # identity transform

    with patch("app.services.ml_service._models", {"random_forest": mock_rf, "logistic_regression": mock_lr}), \
         patch("app.services.ml_service._scaler", mock_scaler):
        yield {"random_forest": mock_rf, "logistic_regression": mock_lr}


@pytest.fixture
def mock_explainers():
    """
    Patch the SHAP explainer registry so SHAP endpoints work
    without real explainer artifacts on disk.
    """
    import numpy as np

    mock_rf_explainer = MagicMock()
    # TreeExplainer returns list of arrays [class_0, class_1]
    mock_rf_explainer.shap_values.return_value = [
        np.zeros((1, 10)),  # class 0
        np.array([[0.05, -0.03, -0.02, 0.01, 0.01, -0.04, -0.03, -0.02, -0.01, -0.01]]),  # class 1
    ]

    mock_lr_explainer = MagicMock()
    mock_lr_explainer.shap_values.return_value = np.array(
        [[0.1, -0.05, -0.03, 0.02, 0.02, -0.06, -0.04, -0.02, -0.01, -0.01]]
    )

    with patch("app.services.shap_service._explainers", {
        "random_forest": mock_rf_explainer,
        "logistic_regression": mock_lr_explainer,
    }):
        yield


@pytest.fixture
def mock_nlp():
    """
    Patch the NLP service so chat and narrative endpoints work
    without calling Groq or Ollama.
    """
    with patch("app.services.nlp_service._call_groq") as mock_groq, \
         patch("app.services.nlp_service._call_ollama_local") as mock_ollama:
        mock_groq.return_value = "This is a simulated narrative response for testing purposes."
        mock_ollama.return_value = "This is a simulated Ollama narrative response for testing purposes."
        yield mock_groq, mock_ollama
