"""
FinWatch Zambia — Auth Attempt Rate Limiting Tests

Verifies that check_and_record_auth_attempt() correctly tracks
per-user login completions within a rolling window and enforces
database-persisted lockouts.
"""

import pytest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.constants import AUTH_ATTEMPT_LIMIT
from app.services.auth_limit_service import check_and_record_auth_attempt


def test_first_attempt_starts_window(db, sme_user):
    """A fresh user's first attempt opens a new rolling window."""
    assert sme_user.auth_attempt_count == 0
    assert sme_user.auth_window_start is None
    assert sme_user.auth_locked_until is None

    check_and_record_auth_attempt(db, sme_user)

    assert sme_user.auth_attempt_count == 1
    assert sme_user.auth_window_start is not None
    assert sme_user.auth_locked_until is None


def test_attempts_increment_within_window(db, sme_user):
    """Attempts within the active window increment the counter."""
    sme_user.auth_attempt_count = 3
    sme_user.auth_window_start = datetime.now(timezone.utc) - timedelta(minutes=10)
    sme_user.auth_locked_until = None
    db.flush()

    check_and_record_auth_attempt(db, sme_user)

    assert sme_user.auth_attempt_count == 4
    assert sme_user.auth_locked_until is None


def test_fifth_attempt_does_not_lock(db, sme_user):
    """The 5th attempt (equal to AUTH_ATTEMPT_LIMIT) is allowed through."""
    sme_user.auth_attempt_count = 4
    sme_user.auth_window_start = datetime.now(timezone.utc) - timedelta(minutes=10)
    sme_user.auth_locked_until = None
    db.flush()

    check_and_record_auth_attempt(db, sme_user)

    assert sme_user.auth_attempt_count == AUTH_ATTEMPT_LIMIT
    assert sme_user.auth_locked_until is None


def test_sixth_attempt_triggers_lockout(db, sme_user):
    """The 6th attempt (exceeding AUTH_ATTEMPT_LIMIT) triggers a 2-hour lockout."""
    sme_user.auth_attempt_count = AUTH_ATTEMPT_LIMIT
    sme_user.auth_window_start = datetime.now(timezone.utc) - timedelta(minutes=10)
    sme_user.auth_locked_until = None
    db.flush()

    with pytest.raises(HTTPException) as exc_info:
        check_and_record_auth_attempt(db, sme_user)

    assert exc_info.value.status_code == 429
    assert sme_user.auth_locked_until is not None
    assert sme_user.auth_locked_until > datetime.now(timezone.utc)
    assert sme_user.auth_attempt_count == 0


def test_lockout_blocks_further_attempts(db, sme_user):
    """A user with an active lockout is immediately blocked."""
    sme_user.auth_locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
    sme_user.auth_attempt_count = 0
    sme_user.auth_window_start = None
    db.flush()

    with pytest.raises(HTTPException) as exc_info:
        check_and_record_auth_attempt(db, sme_user)

    assert exc_info.value.status_code == 429
    assert "locked" in exc_info.value.detail.lower()


def test_expired_lockout_clears_and_allows(db, sme_user):
    """An expired lockout is cleared and the user starts a fresh window."""
    sme_user.auth_locked_until = datetime.now(timezone.utc) - timedelta(minutes=5)
    sme_user.auth_attempt_count = 0
    sme_user.auth_window_start = None
    db.flush()

    check_and_record_auth_attempt(db, sme_user)

    assert sme_user.auth_locked_until is None
    assert sme_user.auth_attempt_count == 1


def test_expired_window_resets_count(db, sme_user):
    """A window that has elapsed resets the counter to 1."""
    sme_user.auth_attempt_count = 4
    sme_user.auth_window_start = datetime.now(timezone.utc) - timedelta(hours=2)
    sme_user.auth_locked_until = None
    db.flush()

    check_and_record_auth_attempt(db, sme_user)

    assert sme_user.auth_attempt_count == 1
    assert sme_user.auth_locked_until is None
