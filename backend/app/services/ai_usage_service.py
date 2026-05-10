"""Usage limit tracking for the chat feature.

This module records chat messages and enforces a rolling rate limit.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.ai_usage_log import AIUsageLog

USAGE_LIMIT = 15
COOLDOWN_HOURS = 2

def get_ai_usage_status(db: Session, user_id: int) -> Tuple[bool, int, Optional[datetime]]:
    """Return whether the user is rate-limited on AI usage and the current window count."""
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=COOLDOWN_HOURS)

    logs = db.query(AIUsageLog).filter(
        AIUsageLog.user_id == user_id,
        AIUsageLog.timestamp > window_start
    ).order_by(AIUsageLog.timestamp.asc()).all()
    
    count = len(logs)

    if count >= USAGE_LIMIT:
        first_msg = logs[0]
        cooldown_until = first_msg.timestamp + timedelta(hours=COOLDOWN_HOURS)
        
        if cooldown_until.tzinfo is None:
            cooldown_until = cooldown_until.replace(tzinfo=timezone.utc)
            
        return True, count, cooldown_until

    return False, count, None

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
