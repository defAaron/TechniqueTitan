"""Shared single-frame analysis and overlay drawing for the UI.

Keeps the Streamlit app thin: photo, video, and live modes all call
``analyze_frame`` and ``draw_overlay`` instead of duplicating the
detect -> features -> score pipeline used by the batch CLI.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

from .detection import HandDetection, HandDetector
from .features import extract_all_features
from .scoring import score_all

# (start, end) landmark index pairs describing the hand skeleton.
_HAND_CONNECTIONS = mp.solutions.hands.HAND_CONNECTIONS

# BGR colors per severity band (OpenCV uses BGR ordering).
_SEVERITY_BGR = {
    "good": (80, 175, 76),      # green
    "warning": (0, 165, 255),   # orange
    "critical": (60, 60, 231),  # red
    "unknown": (150, 150, 150),  # gray
}

# Hex equivalents for Streamlit text/labels.
_SEVERITY_HEX = {
    "good": "#4caf50",
    "warning": "#ffa500",
    "critical": "#e73c3c",
    "unknown": "#969696",
}


@dataclass
class AnalysisResult:
    """Scores and the chosen hand for a single analyzed frame."""

    hand: HandDetection
    criterion_metrics: dict
    scores: dict
    severities: dict
    composite_score: Optional[float]

    @property
    def composite_severity(self) -> str:
        """Worst severity across criteria, used to color the whole hand."""
        order = ["critical", "warning", "good", "unknown"]
        present = [s for s in self.severities.values()]
        for level in order:
            if level in present:
                return level
        return "unknown"


def severity_color(severity: str, *, hex: bool = False):
    """Return the BGR tuple (default) or hex string for a severity band."""
    if hex:
        return _SEVERITY_HEX.get(severity, _SEVERITY_HEX["unknown"])
    return _SEVERITY_BGR.get(severity, _SEVERITY_BGR["unknown"])


def analyze_frame(
    image_bgr: np.ndarray, detector: HandDetector, config: dict
) -> Optional[AnalysisResult]:
    """Detect the best hand in a BGR frame and score its posture.

    Returns ``None`` when no hand is detected. Features prefer world
    landmarks (as the batch CLI does) and fall back to image coordinates.
    """
    detection = detector.detect(image_bgr)
    if not detection.found:
        return None

    hand = max(detection.hands, key=lambda h: h.confidence)
    coords = hand.world_landmarks if hand.world_landmarks is not None else hand.landmarks

    features = extract_all_features(coords, hand.handedness)
    scoring = score_all(features["criterion_metrics"], config)

    return AnalysisResult(
        hand=hand,
        criterion_metrics=features["criterion_metrics"],
        scores=scoring["scores"],
        severities=scoring["severities"],
        composite_score=scoring["composite_score"],
    )


def draw_overlay(image_bgr: np.ndarray, hand: HandDetection, severity: str = "good") -> np.ndarray:
    """Draw the 21 joints and bone connections onto a copy of the frame.

    The skeleton is colored by ``severity`` so problems are visible at a
    glance; joints are drawn in white for contrast.
    """
    annotated = image_bgr.copy()
    h, w = annotated.shape[:2]
    color = severity_color(severity)

    pts = [(int(x * w), int(y * h)) for x, y, _ in hand.landmarks]

    for start, end in _HAND_CONNECTIONS:
        cv2.line(annotated, pts[start], pts[end], color, 2, cv2.LINE_AA)
    for cx, cy in pts:
        cv2.circle(annotated, (cx, cy), 4, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(annotated, (cx, cy), 4, color, 1, cv2.LINE_AA)

    return annotated
