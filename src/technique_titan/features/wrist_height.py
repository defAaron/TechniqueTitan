"""Wrist height: vertical position of the wrist relative to the knuckle line.

Formula (documented per PRD FR-SC-6):
- Take the mean of the four MCP knuckles (5, 9, 13, 17) in normalized,
  wrist-origin, palm-span-scaled coordinates.
- wrist_height_delta = -mean_mcp_y  (image y grows downward, so we negate to
  get a y-up convention: positive = knuckles above the wrist, i.e. the wrist
  sits below the knuckle line / is dropping).
- Values near 0 mean wrist level with knuckles; strongly positive = collapsed
  wrist; negative = wrist lifted above the knuckles.
"""

from __future__ import annotations

import numpy as np

from ..geometry import landmarks as L
from ..geometry import vectors as V


def compute(points_norm: np.ndarray) -> dict:
    knuckle_mean = points_norm[list(L.ALL_MCPS)].mean(axis=0)
    wrist_to_knuckle = V.vector(points_norm[L.WRIST], knuckle_mean)

    # Tilt of the wrist->knuckle axis vs. the palm width axis
    palm_axis = V.vector(points_norm[L.INDEX_MCP], points_norm[L.PINKY_MCP])
    tilt = V.angle_between(wrist_to_knuckle, palm_axis)

    return {
        "vectors": {"wrist_to_knuckle_mean": wrist_to_knuckle.round(4).tolist()},
        "angles_deg": {"wrist_knuckle_tilt": round(tilt, 2)},
        "metrics": {"wrist_height_delta": round(float(-knuckle_mean[1]), 4)},
    }
