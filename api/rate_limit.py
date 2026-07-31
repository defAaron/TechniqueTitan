"""In-memory sliding-window rate limiter for public demo abuse protection."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request


class RateLimiter:
    """Sliding-window limiter keyed by client IP (or other string key)."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            cutoff = now - self.window_seconds
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.max_requests:
                oldest = q[0] if q else now
                retry_after = max(1, int(self.window_seconds - (now - oldest)) + 1)
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please wait a moment and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)


def client_ip(request: Request, *, trust_proxy: bool | None = None) -> str:
    """Resolve client IP for rate limiting.

    X-Forwarded-For is only honored when TRUST_PROXY=1 (or trust_proxy=True),
    so clients cannot bypass limits by spoofing the header on a direct expose.
    """
    import os

    if trust_proxy is None:
        trust_proxy = os.environ.get("TRUST_PROXY", "").strip() in {
            "1",
            "true",
            "True",
            "yes",
        }
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def limiter_bucket(path: str) -> str:
    """Map API paths to cost-based rate-limit buckets.

    Live landmark scoring is cheap (no MediaPipe on the server) and runs at
    ~4 Hz from the browser. Frame/image/video uploads are much heavier.
    """
    if path.rstrip("/").endswith("/score/landmarks"):
        return "landmarks"
    if path.rstrip("/").endswith("/analyze/frame"):
        return "frame"
    return "heavy"


def build_limiters_from_env(
    env: Optional[Dict[str, str]] = None,
) -> Dict[str, RateLimiter]:
    """Create per-bucket limiters from environment variables."""
    import os

    source = env if env is not None else os.environ
    window = int(source.get("RATE_LIMIT_WINDOW", "60"))
    return {
        # Photo + video uploads (expensive decode / MediaPipe).
        "heavy": RateLimiter(
            max_requests=int(source.get("RATE_LIMIT_MAX", "60")),
            window_seconds=window,
        ),
        # Live JPEG frame upload (~2 Hz client default needs headroom).
        "frame": RateLimiter(
            max_requests=int(source.get("RATE_LIMIT_FRAME_MAX", "120")),
            window_seconds=window,
        ),
        # Browser MediaPipe + /score/landmarks (~4 Hz needs ~240+/min).
        "landmarks": RateLimiter(
            max_requests=int(source.get("RATE_LIMIT_LANDMARKS_MAX", "360")),
            window_seconds=window,
        ),
    }
