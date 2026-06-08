import pytest
from datetime import datetime, timedelta, timezone
import secrets

from app.models.user_device_session import UserDeviceSession
from app.services.session_service import register_session, get_active_sessions


def test_register_session_limit(db, sme_user):
    # Register 3 sessions on different devices
    register_session(db, sme_user.id, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "jti1", datetime.now(timezone.utc) + timedelta(days=1))
    register_session(db, sme_user.id, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "jti2", datetime.now(timezone.utc) + timedelta(days=1))
    register_session(db, sme_user.id, "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", "jti3", datetime.now(timezone.utc) + timedelta(days=1))

    # Assert they are all active
    active = get_active_sessions(db, sme_user.id)
    assert len(active) == 3

    # Attempt to register a 4th device (different user agent)
    with pytest.raises(ValueError) as exc:
        register_session(db, sme_user.id, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "jti4", datetime.now(timezone.utc) + timedelta(days=1))
    assert "Maximum authenticated device limit" in str(exc.value)


def test_register_session_same_device_reconciliation(db, sme_user):
    # Register 3 sessions, two different browsers, one mobile
    chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    firefox_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"
    mobile_ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

    register_session(db, sme_user.id, chrome_ua, "jti1", datetime.now(timezone.utc) + timedelta(days=1))
    register_session(db, sme_user.id, firefox_ua, "jti2", datetime.now(timezone.utc) + timedelta(days=1))
    register_session(db, sme_user.id, mobile_ua, "jti3", datetime.now(timezone.utc) + timedelta(days=1))

    # Assert active count is 3
    active = get_active_sessions(db, sme_user.id)
    assert len(active) == 3

    # Log back in from the Chrome browser (same user agent -> same device name/platform/type)
    # This should succeed by revoking the old chrome session and registering the new one, remaining at 3 sessions
    new_session = register_session(db, sme_user.id, chrome_ua, "jti4", datetime.now(timezone.utc) + timedelta(days=1))
    
    active = get_active_sessions(db, sme_user.id)
    assert len(active) == 3
    # Verify the old chrome session "jti1" is gone and the new one "jti4" is active
    jtis = [s.jti for s in active]
    assert "jti1" not in jtis
    assert "jti4" in jtis


def test_register_session_expired_pruning(db, sme_user):
    # Register 3 sessions, but make one expired
    chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    firefox_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"
    mobile_ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

    register_session(db, sme_user.id, chrome_ua, "jti1", datetime.now(timezone.utc) - timedelta(hours=1)) # Expired
    register_session(db, sme_user.id, firefox_ua, "jti2", datetime.now(timezone.utc) + timedelta(days=1))
    register_session(db, sme_user.id, mobile_ua, "jti3", datetime.now(timezone.utc) + timedelta(days=1))

    # Registering a new session (different UA) should succeed because the expired one is pruned
    safari_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    register_session(db, sme_user.id, safari_ua, "jti4", datetime.now(timezone.utc) + timedelta(days=1))

    active = get_active_sessions(db, sme_user.id)
    assert len(active) == 3
    jtis = [s.jti for s in active]
    assert "jti1" not in jtis
    assert "jti4" in jtis


def test_native_mobile_supersedes_primary(db, sme_user):
    # Register a primary browser session
    chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    browser_session = register_session(db, sme_user.id, chrome_ua, "jti_browser", datetime.now(timezone.utc) + timedelta(days=1))
    assert browser_session.is_primary is True

    # Register a native mobile session
    capacitor_ua = "Mozilla/5.0 (Linux; Android 10; Mobile; rv:120.0) Capacitor/5.0"
    mobile_session = register_session(db, sme_user.id, capacitor_ua, "jti_mobile1", datetime.now(timezone.utc) + timedelta(days=30))
    
    # Reload from DB to verify statuses
    db.refresh(browser_session)
    assert mobile_session.is_primary is True
    assert browser_session.is_primary is False # Browser session is demoted

    # Register another native mobile session (e.g. app reinstall on same platform)
    # It should supersede and delete the previous native session
    mobile_session2 = register_session(db, sme_user.id, capacitor_ua, "jti_mobile2", datetime.now(timezone.utc) + timedelta(days=30))
    
    active = get_active_sessions(db, sme_user.id)
    jtis = [s.jti for s in active]
    assert "jti_mobile1" not in jtis
    assert "jti_mobile2" in jtis
    assert mobile_session2.is_primary is True
