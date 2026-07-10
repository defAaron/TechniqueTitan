"""Runs all five criterion feature extractors on one detected hand."""

from __future__ import annotations

import numpy as np

from ..geometry import vectors as V
from . import finger_curvature, hand_arch, thumb_position, wrist_height, wrist_lateral


def extract_all_features(landmarks_21x3: np.ndarray, handedness: str) -> dict:
    """Compute every vector, angle, and criterion metric for one hand.

    Landmarks are normalized (wrist origin, palm-span scale) before any
    measurement so results are camera-distance and hand-size invariant.
    """
    points = V.normalize_landmarks(np.asarray(landmarks_21x3, dtype=float))

    results = {
        "wrist_height": wrist_height.compute(points),
        "finger_curvature": finger_curvature.compute(points),
        "thumb_position": thumb_position.compute(points),
        "wrist_lateral": wrist_lateral.compute(points, handedness),
        "hand_arch": hand_arch.compute(points),
    }

    vectors: dict = {}
    angles: dict = {}
    metrics: dict = {}
    for criterion, out in results.items():
        vectors.update(out["vectors"])
        angles.update({k: v for k, v in out["angles_deg"].items()})
        metrics.update(out["metrics"])

    return {"vectors": vectors, "angles_deg": angles, "criterion_metrics": metrics}
