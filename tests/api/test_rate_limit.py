"""Unit tests for the in-memory rate limiter."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.rate_limit import (
    RateLimiter,
    build_limiters_from_env,
    client_ip,
    limiter_bucket,
)


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
    assert exc.value.headers is not None
    assert "Retry-After" in exc.value.headers


def test_rate_limiter_is_per_key():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("one")
    limiter.check("two")
    with pytest.raises(HTTPException):
        limiter.check("one")


def test_limiter_bucket_by_path():
    assert limiter_bucket("/v1/score/landmarks") == "landmarks"
    assert limiter_bucket("/v1/analyze/frame") == "frame"
    assert limiter_bucket("/v1/analyze/image") == "heavy"
    assert limiter_bucket("/v1/analyze/video") == "heavy"


def test_build_limiters_from_env_defaults():
    limiters = build_limiters_from_env({})
    assert limiters["heavy"].max_requests == 60
    assert limiters["frame"].max_requests == 120
    assert limiters["landmarks"].max_requests == 360
    assert limiters["landmarks"].window_seconds == 60


def test_build_limiters_from_env_overrides():
    limiters = build_limiters_from_env(
        {
            "RATE_LIMIT_MAX": "10",
            "RATE_LIMIT_FRAME_MAX": "20",
            "RATE_LIMIT_LANDMARKS_MAX": "30",
            "RATE_LIMIT_WINDOW": "15",
        }
    )
    assert limiters["heavy"].max_requests == 10
    assert limiters["frame"].max_requests == 20
    assert limiters["landmarks"].max_requests == 30
    assert limiters["heavy"].window_seconds == 15


def test_landmark_and_heavy_budgets_are_independent():
    limiters = build_limiters_from_env(
        {
            "RATE_LIMIT_MAX": "1",
            "RATE_LIMIT_LANDMARKS_MAX": "2",
            "RATE_LIMIT_WINDOW": "60",
        }
    )
    ip = "1.2.3.4"
    limiters["heavy"].check(ip)
    with pytest.raises(HTTPException):
        limiters["heavy"].check(ip)
    # Landmark scoring still allowed after heavy budget is exhausted.
    limiters["landmarks"].check(ip)
    limiters["landmarks"].check(ip)


def test_client_ip_ignores_forwarded_without_trust_proxy():
    req = SimpleNamespace(
        headers={"x-forwarded-for": "9.9.9.9"},
        client=SimpleNamespace(host="1.2.3.4"),
    )
    assert client_ip(req, trust_proxy=False) == "1.2.3.4"
    assert client_ip(req, trust_proxy=True) == "9.9.9.9"
