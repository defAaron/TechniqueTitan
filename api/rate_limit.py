"""In-memory sliding-window rate limiter for public demo abuse protection."""

from __future__ import annotations

import ipaddress
import os
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request

# Memory bound for tracked keys. This is not a request budget: windows and
# per-bucket caps stay at their configured values. Idle and spoofed keys
# cannot grow the dict without limit.
_DEFAULT_MAX_KEYS = 4096
_MAX_FORWARDED_CHARS = 512
_MAX_FORWARDED_HOPS = 8
_MAX_IP_CHARS = 64


class RateLimiter:
    """Sliding-window limiter keyed by client IP (or other string key)."""

    def __init__(
        self,
        max_requests: int = 60,
        window_seconds: int = 60,
        max_keys: int = _DEFAULT_MAX_KEYS,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_keys = max(1, max_keys)
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _make_room(self, key: str, now: float) -> None:
        """Drop expired buckets, then the stalest key, before tracking a new IP."""
        if key in self._hits or len(self._hits) < self.max_keys:
            return
        cutoff = now - self.window_seconds
        expired = [k for k, q in self._hits.items() if not q or q[-1] < cutoff]
        for stale in expired:
            del self._hits[stale]
        if key in self._hits or len(self._hits) < self.max_keys:
            return
        stalest = min(
            self._hits,
            key=lambda k: self._hits[k][-1] if self._hits[k] else 0.0,
        )
        del self._hits[stalest]

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._make_room(key, now)
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


def _header(request: Request, name: str) -> Optional[str]:
    headers = getattr(request, "headers", None)
    if headers is None:
        return None
    value = headers.get(name)
    if isinstance(value, str) and value.strip():
        return value
    return None


def _parse_ip(token: str) -> Optional[str]:
    token = token.strip()
    if token.startswith("[") and token.endswith("]"):
        token = token[1:-1].strip()
    if not token or len(token) > _MAX_IP_CHARS:
        return None
    try:
        return str(ipaddress.ip_address(token))
    except ValueError:
        return None


def _leftmost_forwarded_ip(header: str) -> Optional[str]:
    """Use the client address Render places first in X-Forwarded-For.

    Render documents the first hop as the visitor. A single address is that
    hop. CF-Connecting-IP is preferred when present, because Cloudflare
    overwrites it; this fallback only runs when that header is absent.
    """
    if len(header) > _MAX_FORWARDED_CHARS:
        return None
    parts = [part.strip() for part in header.split(",") if part.strip()]
    for token in parts[:_MAX_FORWARDED_HOPS]:
        parsed = _parse_ip(token)
        if parsed:
            return parsed
    return None


def client_ip(request: Request, *, trust_proxy: bool | None = None) -> str:
    """Resolve client IP for rate limiting.

    Forwarded headers are honored only when TRUST_PROXY=1 (or trust_proxy=True),
    so clients cannot bypass limits by spoofing them on a direct expose.

    On Render, prefer CF-Connecting-IP. Cloudflare overwrites that header with
    the visitor, so a caller cannot rotate it to escape the limit. If it is
    missing, use the first X-Forwarded-For address. Render sets that hop to
    the visitor; the last hop is a proxy, and keying on it would put every
    user in one bucket.
    """
    if trust_proxy is None:
        trust_proxy = os.environ.get("TRUST_PROXY", "").strip() in {
            "1",
            "true",
            "True",
            "yes",
        }
    if trust_proxy:
        cf_ip = _parse_ip((_header(request, "cf-connecting-ip") or "").split(",")[0])
        if cf_ip:
            return cf_ip
        forwarded = _header(request, "x-forwarded-for")
        if forwarded:
            forwarded_ip = _leftmost_forwarded_ip(forwarded)
            if forwarded_ip:
                return forwarded_ip
    if request.client:
        host = request.client.host
        if isinstance(host, str) and host and len(host) <= 128:
            return host
    return "unknown"


def limiter_bucket(path: str) -> str:
    """Map API paths to cost-based rate-limit buckets.

    Live landmark scoring is cheap (no MediaPipe on the server) and runs at
    ~4 Hz from the browser. Frame/image/video uploads are much heavier.
    """
    if path.rstrip("/").endswith("/coach/plan"):
        return "landmarks"
    if path.rstrip("/").endswith("/score/landmarks"):
        return "landmarks"
    if path.rstrip("/").endswith("/analyze/frame"):
        return "frame"
    if path.rstrip("/").endswith("/progress/reduce"):
        return "heavy"
    return "heavy"


def build_limiters_from_env(
    env: Optional[Dict[str, str]] = None,
) -> Dict[str, RateLimiter]:
    """Create per-bucket limiters from environment variables."""
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
