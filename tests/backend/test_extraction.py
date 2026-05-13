"""
FinWatch Zambia — Integration Tests: Document Extraction

Tests for the /api/predictions/extract-data endpoint and extraction service logic.
"""

import pytest
import io
from unittest.mock import patch, MagicMock, AsyncMock

def test_extract_data_requires_two_files(client, sme_headers):
    """Verify that the endpoint rejects fewer than 2 files."""
    files = [
        ("files", ("bs.pdf", b"pdf content", "application/pdf"))
    ]
    res = client.post("/api/predictions/extract-data", files=files, headers=sme_headers)
    assert res.status_code == 400
    assert "Two documents" in res.json()["detail"]

@patch("app.services.extraction_service.extract_text_from_pdf")
@patch("app.services.extraction_service.run_fallback_chain", new_callable=AsyncMock)
def test_extract_data_pdf_success(mock_nlp, mock_text, client, sme_headers):
    """Verify successful PDF extraction via mocked NLP."""
    mock_text.return_value = "Extracted text from PDF. This is a long enough string to pass the length check and simulate real document content for testing purposes."
    # Mock NLP response
    mock_nlp.return_value = (
        '{"current_assets": 1000.0, "current_liabilities": 500.0, "total_assets": 5000.0}',
        "groq"
    )
    
    files = [
        ("files", ("bs.pdf", b"fake pdf", "application/pdf")),
        ("files", ("is.pdf", b"fake pdf", "application/pdf"))
    ]
    
    res = client.post("/api/predictions/extract-data", files=files, headers=sme_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_assets"] == 1000.0
    assert data["current_liabilities"] == 500.0
    assert data["total_assets"] == 5000.0

def test_extract_data_spreadsheet_success(client, sme_headers):
    """Verify successful CSV extraction."""
    bs_content = "Label,Value\nCurrent Assets,2000\nCurrent Liabilities,1000\nTotal Assets,8000"
    is_content = "Label,Value\nRevenue,5000\nNet Income,1200\nEBIT,1500"
    
    files = [
        ("files", ("bs.csv", bs_content.encode(), "text/csv")),
        ("files", ("is.csv", is_content.encode(), "text/csv"))
    ]
    
    res = client.post("/api/predictions/extract-data", files=files, headers=sme_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_assets"] == 2000.0
    assert data["current_liabilities"] == 1000.0
    assert data["total_assets"] == 8000.0
    assert data["revenue"] == 5000.0
    assert data["net_income"] == 1200.0

def test_extract_data_unauthenticated_rejected(client):
    """Verify unauthenticated requests are rejected."""
    files = [
        ("files", ("bs.pdf", b"content", "application/pdf")),
        ("files", ("is.pdf", b"content", "application/pdf"))
    ]
    res = client.post("/api/predictions/extract-data", files=files)
    assert res.status_code == 401
