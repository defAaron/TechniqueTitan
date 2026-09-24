"""Progress persistence limits (Supabase free-tier budget)."""

from __future__ import annotations

from technique_titan.eval.constants import CRITERIA

MAX_SAMPLES_PER_HAND = 120
MAX_SAMPLES_JSON_BYTES = 32 * 1024
FLICKER_MS = 300
HEARTBEAT_MS = 1000

__all__ = [
    "CRITERIA",
    "MAX_SAMPLES_PER_HAND",
    "MAX_SAMPLES_JSON_BYTES",
    "FLICKER_MS",
    "HEARTBEAT_MS",
]
