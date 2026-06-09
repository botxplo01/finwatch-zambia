"""
FinWatch Zambia - Global Application Constants

This module contains shared constants used across the ML pipeline,
analytical services, and core domain logic.
"""

DISTRESS_CLASS_INDEX: int = 1
RANDOM_STATE: int = 42

# Per-user authentication attempt rate limiting
AUTH_ATTEMPT_LIMIT: int = 5
AUTH_WINDOW_SECONDS: int = 3600
AUTH_LOCKOUT_SECONDS: int = 7200
