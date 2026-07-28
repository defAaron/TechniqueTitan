"""Unit tests for the in-memory rate limiter."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from api.rate_limit import RateLimiter


def test_rate_limiter_allows_under_cap():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    limiter.check("a")
    limiter.check("a")
    limiter.check("a")


def test_rate_limiter_blocks_over_cap():
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    limiter.check("b")
    limiter.check("b")
    with pytest.raises(HTTPException) as exc:
        limiter.check("b")
    assert exc.value.status_code == 429


def test_rate_limiter_is_per_key():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("one")
    limiter.check("two")
    with pytest.raises(HTTPException):
        limiter.check("one")
