"""Shared singletons (detector + YAML configs) for request handlers."""

from __future__ import annotations

import logging
from functools import lru_cache

from technique_titan.coaching import load_coaching_config
from technique_titan.detection import HandDetector
from technique_titan.scoring import load_config

logger = logging.getLogger(__name__)

_CLIENT_DETAIL_MAX = 300


@lru_cache(maxsize=1)
def get_scoring_config() -> dict:
    return load_config()


@lru_cache(maxsize=1)
def get_coaching_config() -> dict:
    return load_coaching_config()


@lru_cache(maxsize=1)
def get_static_detector() -> HandDetector:
    """Static-image detector reused across photo requests."""
    return HandDetector(static_image_mode=True, max_hands=2)


def public_value_error_detail(exc: ValueError, fallback: str) -> str:
    """Return a client-safe message.

    Temp video files live under paths like ``/tmp/...``. Those strings must
    not be copied into HTTP error bodies. Stable, path-free messages pass
    through so validation text stays the same.
    """
    text = str(exc).strip()
    unsafe = (
        not text
        or len(text) > _CLIENT_DETAIL_MAX
        or any(mark in text for mark in ("/", "\\", "\n", "\r", "\x00"))
    )
    if unsafe:
        logger.warning(
            "redacted client error: %s",
            str(exc).replace("\n", "\\n")[:_CLIENT_DETAIL_MAX],
        )
        return fallback
    return text
