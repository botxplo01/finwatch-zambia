"""
FinWatch Zambia - Global Application Constants

This module contains shared constants used across the ML pipeline,
analytical services, and core domain logic.
"""

DISTRESS_CLASS_INDEX: int = 1
RANDOM_STATE: int = 42

AUTH_ATTEMPT_LIMIT: int = 5
AUTH_WINDOW_SECONDS: int = 3600
AUTH_LOCKOUT_SECONDS: int = 7200

CONVERSATION_LIMIT: int = 25
CONVERSATION_MAX_USER_MESSAGES: int = 20
CONVERSATION_MAX_AI_RESPONSES: int = 20

