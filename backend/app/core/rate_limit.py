"""
FinWatch Zambia - Rate Limiting Utility

Provides lightweight, in-memory IP-based rate limiting for sensitive endpoints.
"""

import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request, status

# In-memory storage: {ip: (count, first_request_time)}
_storage: Dict[str, Tuple[int, float]] = {}

# Limits: 10 requests per 1 minute for sensitive auth actions
LIMIT_COUNT = 10
LIMIT_WINDOW_SECONDS = 60


def rate_limit(request: Request):
    """
    Dependency that enforces IP-based rate limiting.
    Raises 429 Too Many Requests if limit exceeded.
    """
    client_ip = request.client.host
    now = time.time()

    if client_ip not in _storage:
        _storage[client_ip] = (1, now)
        return

    count, start_time = _storage[client_ip]

    # Check if window has passed
    if now - start_time > LIMIT_WINDOW_SECONDS:
        # Reset window
        _storage[client_ip] = (1, now)
        return

    if count >= LIMIT_COUNT:
        retry_after = int(LIMIT_WINDOW_SECONDS - (now - start_time))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Increment count
    _storage[client_ip] = (count + 1, start_time)
