"""Overall hand arch: the dome formed by the knuckle bridge.

Formula (documented per PRD FR-SC-6):
- knuckle_bridge angle: interior angle at the middle MCP (9) between the
  index MCP (5) and ring MCP (13). A flat knuckle line reads ~180 deg; a
  domed bridge reads lower.
- mcp_dome_spread: standard deviation of the four MCPs' distances from their
  own best-fit plane (0 = perfectly planar knuckle line).
- hand_arch_ratio: peak MCP elevation above the palm base plane (best-fit
  plane through wrist, index MCP, pinky MCP), in palm-span units. Higher =
  more pronounced dome; near 0 = collapsed/flat hand.
"""

from __future__ import annotations

import numpy as np

from ..geometry import landmarks as L
from ..geometry import vectors as V


def compute(points_norm: np.ndarray) -> dict:
    mcps = points_norm[list(L.ALL_MCPS)]

    bridge = V.angle_at_joint(
        points_norm[L.INDEX_MCP], points_norm[L.MIDDLE_MCP], points_norm[L.RING_MCP]
    )

    centroid, normal = V.fit_plane(mcps)
    dome_spread = float(np.std([V.point_plane_distance(p, centroid, normal) for p in mcps]))

    base_centroid, base_normal = V.fit_plane(points_norm[[L.WRIST, L.INDEX_MCP, L.PINKY_MCP]])
    elevations = [
        abs(V.point_plane_distance(p, base_centroid, base_normal))
        for p in (points_norm[L.MIDDLE_MCP], points_norm[L.RING_MCP])
    ]
    arch_ratio = float(max(elevations))

    return {
        "vectors": {
            "wrist_to_index_mcp": V.vector(points_norm[L.WRIST], points_norm[L.INDEX_MCP]).round(4).tolist(),
            "wrist_to_pinky_mcp": V.vector(points_norm[L.WRIST], points_norm[L.PINKY_MCP]).round(4).tolist(),
        },
        "angles_deg": {"knuckle_bridge": round(bridge, 2)},
        "metrics": {
            "mcp_dome_spread": round(dome_spread, 4),
            "hand_arch_ratio": round(arch_ratio, 4),
        },
    }
