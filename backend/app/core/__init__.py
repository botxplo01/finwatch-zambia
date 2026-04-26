"""
FinWatch Zambia - Core Package

Exposes the settings singleton and key security utilities for clean imports.
"""

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

__all__ = [
    "settings",
    "create_access_token",
    "decode_access_token",
    "hash_password",
    "verify_password",
]
