import asyncio
import time
from collections import defaultdict, deque
from typing import Dict
import redis as redis_lib
from app.config import settings


class InMemoryRateLimiter:
    """Simple in-memory rate limiter for per-channel throttling."""

    def __init__(self):
        self._windows: Dict[str, deque] = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window = self._windows[key]
        while window and window[0] < now - window_seconds:
            window.popleft()
        if len(window) >= max_requests:
            return False
        window.append(now)
        return True

    def remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        now = time.time()
        window = self._windows[key]
        while window and window[0] < now - window_seconds:
            window.popleft()
        return max(0, max_requests - len(window))


rate_limiter = InMemoryRateLimiter()


def check_whatsapp_rate(user_id: int) -> bool:
    return rate_limiter.is_allowed(
        f"wa:{user_id}",
        max_requests=settings.MAX_MESSAGES_PER_HOUR,
        window_seconds=3600,
    )


def check_email_rate(user_id: int) -> bool:
    return rate_limiter.is_allowed(
        f"email:{user_id}",
        max_requests=settings.MAX_EMAILS_PER_HOUR,
        window_seconds=3600,
    )
