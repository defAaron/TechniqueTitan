"""Wrist lateral deviation: sideways (ulnar/radial) bend of the hand axis.

Formula (documented per PRD FR-SC-6):
- Hand axis: wrist (0) -> middle MCP (9), a proxy for the forearm-to-hand line.
- Palm width axis: index MCP (5) -> pinky MCP (17).
- On a straight wrist these axes are roughly perpendicular, so
  deviation = (angle between the axes) - 90.
- The sign is oriented by handedness so positive always means ulnar deviation
  (bend toward the pinky side) for either hand.
"""

from __future__ import annotations

import numpy as np

from ..geometry import landmarks as L
from ..geometry import vectors as V


def compute(points_norm: np.ndarray, handedness: str) -> dict:
    hand_axis = V.vector(points_norm[L.WRIST], points_norm[L.MIDDLE_MCP])
    width_axis = V.vector(points_norm[L.INDEX_MCP], points_norm[L.PINKY_MCP])

    deviation = V.angle_between(hand_axis, width_axis) - 90.0

    # In image coordinates the width axis points index->pinky; for a left hand
    # that direction is mirrored, so flip the sign to keep "positive = ulnar".
    if handedness.lower() == "left":
        deviation = -deviation

    return {
        "vectors": {
            "hand_axis": hand_axis.round(4).tolist(),
            "palm_width_axis": width_axis.round(4).tolist(),
        },
        "angles_deg": {"wrist_lateral_deviation": round(deviation, 2)},
        "metrics": {"wrist_lateral_deviation_deg": round(float(deviation), 2)},
    }
