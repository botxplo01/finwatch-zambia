"""Usage limit tracking for the chat feature.

This module records chat messages and enforces a rolling rate limit.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.ai_usage_log import AIUsageLog

USAGE_LIMIT = 10
COOLDOWN_HOURS = 2

def get_ai_usage_status(db: Session, user_id: int) -> Tuple[bool, int, Optional[datetime]]:
    """Return whether the user is rate-limited on AI usage and the current window count."""
    now = datetime.now(timezone.utc)
    
    # 1. Get the last USAGE_LIMIT messages ever sent by this user
    logs = db.query(AIUsageLog).filter(
        AIUsageLog.user_id == user_id
    ).order_by(AIUsageLog.timestamp.desc()).limit(USAGE_LIMIT).all()
    
    # We want them in ascending order for calculation
    logs.reverse()
    count_total = len(logs)

    # Normalize timestamps to UTC (ensures compatibility with SQLite)
    for log in logs:
        if log.timestamp.tzinfo is None:
            log.timestamp = log.timestamp.replace(tzinfo=timezone.utc)

    # 2. If they haven't even sent USAGE_LIMIT messages yet, they can't be blocked by a burst
    if count_total < USAGE_LIMIT:
        # Check current sliding window just for the counter display
        window_start = now - timedelta(hours=COOLDOWN_HOURS)
        current_window_count = sum(1 for log in logs if log.timestamp > window_start)
        return False, current_window_count, None

    # 3. Check if the most recent USAGE_LIMIT messages constitute a "Burst"
    latest_msg = logs[-1]
    earliest_in_burst = logs[0]
    
    burst_duration = latest_msg.timestamp - earliest_in_burst.timestamp
    
    if burst_duration < timedelta(hours=COOLDOWN_HOURS):
        cooldown_until = latest_msg.timestamp + timedelta(hours=COOLDOWN_HOURS)
        
        if now < cooldown_until:
            return True, USAGE_LIMIT, cooldown_until

    # 4. If not in a hard block, return count in the current sliding window for the UI
    window_start = now - timedelta(hours=COOLDOWN_HOURS)
    current_window_count = sum(1 for log in logs if log.timestamp > window_start)
    return False, current_window_count, None

def log_ai_message(db: Session, user_id: int) -> Tuple[bool, Optional[datetime]]:
    """Record a new chat message and indicate whether the user just became blocked."""
    new_log = AIUsageLog(user_id=user_id)
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    is_blocked, count, cooldown_until = get_ai_usage_status(db, user_id)
    
    if is_blocked and count == USAGE_LIMIT:
        return True, cooldown_until
    
    return False, None
