import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from technique_titan.geometry import landmarks as L  # noqa: E402


def build_flat_hand() -> np.ndarray:
    """Synthetic right hand, palm-down on the z=0 plane, fingers dead straight.

    Known properties (in image-style coords, y grows downward):
    - wrist at (0.5, 0.8), knuckle line at y=0.5 -> palm span 0.30
    - middle MCP directly above the wrist -> zero lateral deviation
    - all PIP/DIP joint angles exactly 180 deg (flat fingers)
    - everything on z=0 -> zero arch, zero thumb lateral offset
    """
    pts = np.zeros((21, 3))
    pts[L.WRIST] = (0.50, 0.80, 0.0)

    pts[L.THUMB_CMC] = (0.42, 0.72, 0.0)
    pts[L.THUMB_MCP] = (0.36, 0.65, 0.0)
    pts[L.THUMB_IP] = (0.31, 0.60, 0.0)
    pts[L.THUMB_TIP] = (0.27, 0.56, 0.0)

    mcp_x = {"index": 0.35, "middle": 0.50, "ring": 0.60, "pinky": 0.65}
    for finger, chain in L.FINGER_CHAINS.items():
        mcp, pip, dip, tip = chain
        x = mcp_x[finger]
        pts[mcp] = (x, 0.50, 0.0)
        pts[pip] = (x, 0.40, 0.0)
        pts[dip] = (x, 0.33, 0.0)
        pts[tip] = (x, 0.26, 0.0)
    return pts


@pytest.fixture
def flat_hand() -> np.ndarray:
    return build_flat_hand()


@pytest.fixture
def curved_hand() -> np.ndarray:
    """Flat hand with index finger bent 90 degrees at the PIP joint."""
    pts = build_flat_hand()
    # PIP stays; DIP and TIP fold horizontally so the angle at PIP is 90 deg
    x, pip_y = pts[L.INDEX_PIP][0], pts[L.INDEX_PIP][1]
    pts[L.INDEX_DIP] = (x + 0.07, pip_y, 0.0)
    pts[L.INDEX_TIP] = (x + 0.14, pip_y, 0.0)
    return pts
