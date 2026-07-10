"""MediaPipe Hands wrapper that returns structured landmark data.

Evolves the prototype in `scripts/hand_detector_prototype.py` into an
importable component (PRD FR-PD-1, FR-PD-2, FR-PD-3, FR-PD-5).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

import cv2
import mediapipe as mp
import numpy as np


@dataclass
class HandDetection:
    """One detected hand: 21 landmarks + laterality + confidence."""

    # (21, 3) image-normalized coordinates: x, y in [0, 1], z relative depth
    landmarks: np.ndarray
    # (21, 3) world coordinates in meters, origin at hand center.
    # More stable for 3D angle math; may be None for older mediapipe versions.
    world_landmarks: Optional[np.ndarray]
    handedness: str  # "Left" or "Right" (as seen from the camera's mirror view)
    confidence: float  # handedness classification score, used as quality signal

    def to_dict(self) -> dict:
        return {
            "handedness": self.handedness,
            "confidence": round(self.confidence, 4),
            "landmarks": self.landmarks.round(6).tolist(),
            "world_landmarks": (
                self.world_landmarks.round(6).tolist()
                if self.world_landmarks is not None
                else None
            ),
        }


@dataclass
class DetectionResult:
    hands: List[HandDetection] = field(default_factory=list)

    @property
    def found(self) -> bool:
        return len(self.hands) > 0


def _landmark_array(landmark_list) -> np.ndarray:
    return np.array([[lm.x, lm.y, lm.z] for lm in landmark_list.landmark], dtype=float)


class HandDetector:
    """Extracts hand landmarks from static images (batch mode) or video frames."""

    def __init__(
        self,
        static_image_mode: bool = True,
        max_hands: int = 2,
        min_detection_confidence: float = 0.5,
    ):
        self._hands = mp.solutions.hands.Hands(
            static_image_mode=static_image_mode,
            max_num_hands=max_hands,
            min_detection_confidence=min_detection_confidence,
        )

    def detect(self, image_bgr: np.ndarray) -> DetectionResult:
        """Run MediaPipe on a BGR image (as loaded by cv2.imread)."""
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self._hands.process(rgb)

        detection = DetectionResult()
        if not results.multi_hand_landmarks:
            return detection

        world_lists = results.multi_hand_world_landmarks or []
        handedness_lists = results.multi_handedness or []

        for i, hand_lms in enumerate(results.multi_hand_landmarks):
            world = _landmark_array(world_lists[i]) if i < len(world_lists) else None
            if i < len(handedness_lists):
                cls = handedness_lists[i].classification[0]
                label, score = cls.label, cls.score
            else:
                label, score = "Unknown", 0.0

            detection.hands.append(
                HandDetection(
                    landmarks=_landmark_array(hand_lms),
                    world_landmarks=world,
                    handedness=label,
                    confidence=float(score),
                )
            )
        return detection

    def close(self) -> None:
        self._hands.close()

    def __enter__(self) -> "HandDetector":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
