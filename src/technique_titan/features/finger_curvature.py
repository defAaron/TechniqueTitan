"""Finger curvature: natural curve vs. flat or over-clenched fingers.

Formula (documented per PRD FR-SC-6):
- For each long finger (index, middle, ring, pinky) compute the interior
  joint angle at the PIP and DIP joints (8 angles total).
- A straight/flat finger reads ~180 deg per joint; a healthy curve sits
  roughly in the 115-160 deg band; an over-clenched fist reads much lower.
- mean_finger_curvature = mean of the 8 joint angles.
"""

from __future__ import annotations

import numpy as np

from ..geometry import landmarks as L
from ..geometry import vectors as V


def compute(points_norm: np.ndarray) -> dict:
    angles = {}
    for finger, chain in L.FINGER_CHAINS.items():
        joint_angles = V.finger_joint_angles(points_norm, chain)
        angles[f"{finger}_pip"] = round(joint_angles["pip"], 2)
        angles[f"{finger}_dip"] = round(joint_angles["dip"], 2)

    values = [a for a in angles.values() if not np.isnan(a)]
    mean_curvature = float(np.mean(values)) if values else float("nan")

    return {
        "vectors": {},
        "angles_deg": angles,
        "metrics": {"mean_finger_curvature": round(mean_curvature, 2)},
    }
