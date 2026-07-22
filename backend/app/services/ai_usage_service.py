"""Usage limit tracking for the chat feature.

This module records chat messages and enforces a rolling rate limit.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.ai_usage_log import AIUsageLog

COOLDOWN_HOURS = 2

AI_LIMITS = {"portal": 10, "docs": 15}

def get_ai_usage_status(
    db: Session, user_id: int, ai_type: str = "portal"
) -> Tuple[bool, int, Optional[datetime]]:
    """Return whether the user is rate-limited on AI usage and the current window count."""
    now = datetime.now(timezone.utc)
    limit = AI_LIMITS.get(ai_type, 10)

    logs = (
        db.query(AIUsageLog)
        .filter(AIUsageLog.user_id == user_id, AIUsageLog.ai_type == ai_type)
        .order_by(AIUsageLog.timestamp.desc())
        .limit(limit)
        .all()
    )

    logs.reverse()
    count_total = len(logs)

    for log in logs:
        if log.timestamp.tzinfo is None:
            log.timestamp = log.timestamp.replace(tzinfo=timezone.utc)

    if count_total < limit:

        window_start = now - timedelta(hours=COOLDOWN_HOURS)
        current_window_count = sum(1 for log in logs if log.timestamp > window_start)
        return False, current_window_count, None

    latest_msg = logs[-1]
    earliest_in_burst = logs[0]

    burst_duration = latest_msg.timestamp - earliest_in_burst.timestamp

    if burst_duration < timedelta(hours=COOLDOWN_HOURS):
        cooldown_until = latest_msg.timestamp + timedelta(hours=COOLDOWN_HOURS)

        if now < cooldown_until:
            return True, limit, cooldown_until

    window_start = now - timedelta(hours=COOLDOWN_HOURS)
    current_window_count = sum(1 for log in logs if log.timestamp > window_start)
    return False, current_window_count, None

def log_ai_message(
    db: Session, user_id: int, ai_type: str = "portal"
) -> Tuple[bool, Optional[datetime]]:
    """Record a new chat message and indicate whether the user just became blocked."""
    new_log = AIUsageLog(user_id=user_id, ai_type=ai_type)
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    is_blocked, count, cooldown_until = get_ai_usage_status(
        db, user_id, ai_type=ai_type
    )
    limit = AI_LIMITS.get(ai_type, 10)

    if is_blocked and count == limit:
        return True, cooldown_until

    return False, None
