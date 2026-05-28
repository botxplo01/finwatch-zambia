"""
FinWatch Zambia - QR Auth Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class QRInitResponse(BaseModel):
    token: str
    expires_at: datetime
    poll_interval: int = 2  # Seconds


class QRStatusResponse(BaseModel):
    status: str
    access_token: Optional[str] = None


class QRApproveRequest(BaseModel):
    token: str
