"""Shared singletons (detector + YAML configs) for request handlers."""

from __future__ import annotations

from functools import lru_cache

from technique_titan.coaching import load_coaching_config
from technique_titan.detection import HandDetector
from technique_titan.scoring import load_config


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


def make_video_detector() -> HandDetector:
    """Video/live detector — create per request/session (stateful tracking)."""
    return HandDetector(static_image_mode=False, max_hands=2)
