"""
FinWatch Zambia - AI Usage Service

Handles logic for tracking and enforcing AI Assistant usage limits.
Limit: 15 messages within a rolling 2-hour window.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.ai_usage_log import AIUsageLog

USAGE_LIMIT = 15
COOLDOWN_HOURS = 2

def get_ai_usage_status(db: Session, user_id: int) -> Tuple[bool, int, Optional[datetime]]:
    """
    Checks the current AI usage status for a user.
    Returns: (is_blocked, current_count, cooldown_until)
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=COOLDOWN_HOURS)

    # Count messages in the rolling window
    count = db.query(AIUsageLog).filter(
        AIUsageLog.user_id == user_id,
        AIUsageLog.timestamp > window_start
    ).count()

    if count >= USAGE_LIMIT:
        # Get the timestamp of the 15th most recent message in the window
        # The cooldown should last until 2 hours after that 15th message.
        # Actually, if we use a rolling window, the moment that 15th message 
        # drops out of the window, the user is unblocked.
        # That happens exactly 2 hours after the 1st message in the current block of 15.
        
        # Get the oldest message in the current window of 15+
        oldest_in_window = db.query(AIUsageLog).filter(
            AIUsageLog.user_id == user_id,
            AIUsageLog.timestamp > window_start
        ).order_by(AIUsageLog.timestamp.asc()).first()
        
        if oldest_in_window:
            cooldown_until = oldest_in_window.timestamp + timedelta(hours=COOLDOWN_HOURS)
            return True, count, cooldown_until

    return False, count, None

def log_ai_message(db: Session, user_id: int) -> Tuple[bool, Optional[datetime]]:
    """
    Logs a new AI message and checks if the limit was reached.
    Returns: (just_blocked, cooldown_until)
    """
    new_log = AIUsageLog(user_id=user_id)
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    is_blocked, count, cooldown_until = get_ai_usage_status(db, user_id)
    
    # We only care if they reached EXACTLY the limit right now
    if is_blocked and count == USAGE_LIMIT:
        return True, cooldown_until
    
    return False, None
