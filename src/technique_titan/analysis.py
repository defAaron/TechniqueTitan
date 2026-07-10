"""Shared single-frame analysis and overlay drawing for the UI.

Keeps the Streamlit app thin: photo, video, and live modes all call
``analyze_frame`` and ``draw_overlay`` instead of duplicating the
detect -> features -> score pipeline used by the batch CLI.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

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
    """Scores for one analyzed hand in a frame."""

    hand: HandDetection
    label: str  # resolved "Left"/"Right", guaranteed distinct between hands
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


def resolve_labels(hands: List[HandDetection]) -> List[str]:
    """Return a distinct "Left"/"Right" label for each detected hand.

    MediaPipe's own handedness is used when the hands already differ. When it
    reports the same label for both (a known failure mode), the hands are told
    apart by wrist x-position: the left-most hand in the image is labeled
    "Right" (a front-view heuristic that is sensitive to camera mirroring, but
    guarantees the two outputs stay distinct).
    """
    labels = [h.handedness for h in hands]
    if len(hands) < 2 or len(set(labels)) == len(labels):
        return labels

    # Collision (or all-same): assign by wrist x-position, smallest x -> Right.
    order = sorted(range(len(hands)), key=lambda i: hands[i].landmarks[0][0])
    resolved = [""] * len(hands)
    for rank, idx in enumerate(order):
        resolved[idx] = "Right" if rank == 0 else "Left"
    return resolved


def _score_hand(hand: HandDetection, label: str, config: dict) -> AnalysisResult:
    coords = hand.world_landmarks if hand.world_landmarks is not None else hand.landmarks
    features = extract_all_features(coords, hand.handedness)
    scoring = score_all(features["criterion_metrics"], config)
    return AnalysisResult(
        hand=hand,
        label=label,
        criterion_metrics=features["criterion_metrics"],
        scores=scoring["scores"],
        severities=scoring["severities"],
        composite_score=scoring["composite_score"],
    )


def analyze_hands(
    image_bgr: np.ndarray, detector: HandDetector, config: dict
) -> List[AnalysisResult]:
    """Detect and score every hand in a BGR frame.

    Returns one ``AnalysisResult`` per detected hand (empty list when none),
    with distinct resolved labels. Features prefer world landmarks (as the
    batch CLI does) and fall back to image coordinates.
    """
    detection = detector.detect(image_bgr)
    if not detection.found:
        return []

    labels = resolve_labels(detection.hands)
    return [
        _score_hand(hand, label, config)
        for hand, label in zip(detection.hands, labels)
    ]


def _draw_hand(
    annotated: np.ndarray, hand: HandDetection, severity: str, marker: str = ""
) -> None:
    """Draw one hand's skeleton (and optional L/R marker) in place."""
    h, w = annotated.shape[:2]
    color = severity_color(severity)
    pts = [(int(x * w), int(y * h)) for x, y, _ in hand.landmarks]

    for start, end in _HAND_CONNECTIONS:
        cv2.line(annotated, pts[start], pts[end], color, 2, cv2.LINE_AA)
    for cx, cy in pts:
        cv2.circle(annotated, (cx, cy), 4, (255, 255, 255), -1, cv2.LINE_AA)
        cv2.circle(annotated, (cx, cy), 4, color, 1, cv2.LINE_AA)

    if marker:
        wx, wy = pts[0]
        cv2.putText(annotated, marker, (wx - 10, wy + 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(annotated, marker, (wx - 10, wy + 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2, cv2.LINE_AA)


def draw_overlay(image_bgr: np.ndarray, hand: HandDetection, severity: str = "good") -> np.ndarray:
    """Draw one hand's 21 joints and bone connections onto a copy of the frame.

    The skeleton is colored by ``severity`` so problems are visible at a
    glance; joints are drawn in white for contrast.
    """
    annotated = image_bgr.copy()
    _draw_hand(annotated, hand, severity)
    return annotated


def draw_all_overlays(image_bgr: np.ndarray, results: List[AnalysisResult]) -> np.ndarray:
    """Draw every analyzed hand onto a copy of the frame.

    Each hand is colored by its own worst-severity band and tagged with an
    "L"/"R" marker near the wrist so the two hands are visually separable.
    """
    annotated = image_bgr.copy()
    for result in results:
        _draw_hand(annotated, result.hand, result.composite_severity, result.label[:1].upper())
    return annotated
