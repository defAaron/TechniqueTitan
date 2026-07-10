"""Thumb position: resting on its side near the keys, not tucked or flared.

Formula (documented per PRD FR-SC-6):
- thumb_mcp_abduction: interior angle at the thumb MCP (2) between the
  CMC (1) and the thumb tip (4). Very small = tucked/clenched thumb.
- thumb_index_angle: angle between the thumb axis (MCP->TIP) and the index
  finger axis (index MCP->TIP). Near 0 = thumb glued to the index finger
  (tucked); very large = thumb sticking out sideways.
- thumb_lateral_offset: signed distance of the thumb tip from the palm plane
  (best-fit plane through wrist, index MCP, pinky MCP), in palm-span units.
"""

from __future__ import annotations

import numpy as np

from ..geometry import landmarks as L
from ..geometry import vectors as V


def compute(points_norm: np.ndarray) -> dict:
    abduction = V.angle_at_joint(
        points_norm[L.THUMB_CMC], points_norm[L.THUMB_MCP], points_norm[L.THUMB_TIP]
    )

    thumb_axis = V.vector(points_norm[L.THUMB_MCP], points_norm[L.THUMB_TIP])
    index_axis = V.vector(points_norm[L.INDEX_MCP], points_norm[L.INDEX_TIP])
    thumb_index = V.angle_between(thumb_axis, index_axis)

    palm_points = points_norm[[L.WRIST, L.INDEX_MCP, L.PINKY_MCP]]
    centroid, normal = V.fit_plane(palm_points)
    lateral_offset = V.point_plane_distance(points_norm[L.THUMB_TIP], centroid, normal)

    return {
        "vectors": {
            "thumb_axis": thumb_axis.round(4).tolist(),
            "index_axis": index_axis.round(4).tolist(),
        },
        "angles_deg": {
            "thumb_mcp_abduction": round(abduction, 2),
            "thumb_index_angle": round(thumb_index, 2),
        },
        "metrics": {
            "thumb_index_angle": round(thumb_index, 2),
            "thumb_lateral_offset": round(abs(float(lateral_offset)), 4),
        },
    }
