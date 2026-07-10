import numpy as np
import pytest

from technique_titan.analysis import analyze_hands, resolve_labels
from technique_titan.detection import DetectionResult, HandDetection
from technique_titan.scoring import load_config


def make_hand(landmarks: np.ndarray, handedness: str, confidence: float = 0.95) -> HandDetection:
    return HandDetection(
        landmarks=landmarks,
        world_landmarks=None,  # forces feature use of image landmarks
        handedness=handedness,
        confidence=confidence,
    )


class StubDetector:
    """Returns a fixed DetectionResult, bypassing MediaPipe/image decoding."""

    def __init__(self, hands):
        self._hands = hands

    def detect(self, image_bgr):
        return DetectionResult(hands=list(self._hands))


def test_analyze_hands_returns_result_per_hand(flat_hand, curved_hand):
    right = make_hand(flat_hand, "Right")
    left = make_hand(curved_hand + np.array([0.2, 0.0, 0.0]), "Left")
    detector = StubDetector([right, left])

    results = analyze_hands(None, detector, load_config())

    assert len(results) == 2
    assert {r.label for r in results} == {"Left", "Right"}
    # Independent scoring: the curved hand differs from the flat hand.
    by_label = {r.label: r for r in results}
    assert by_label["Right"].composite_score != by_label["Left"].composite_score


def test_analyze_hands_empty_when_no_hands():
    detector = StubDetector([])
    assert analyze_hands(None, detector, load_config()) == []


def test_resolve_labels_keeps_distinct_mediapipe_labels(flat_hand):
    hands = [make_hand(flat_hand, "Left"), make_hand(flat_hand + np.array([0.2, 0, 0]), "Right")]
    assert resolve_labels(hands) == ["Left", "Right"]


def test_resolve_labels_splits_colliding_labels_by_position(flat_hand):
    # Both wrongly reported as "Right"; must still come out distinct.
    left_in_image = make_hand(flat_hand, "Right")  # wrist x = 0.50 (smaller)
    right_in_image = make_hand(flat_hand + np.array([0.3, 0, 0]), "Right")  # wrist x = 0.80
    labels = resolve_labels([left_in_image, right_in_image])

    assert set(labels) == {"Left", "Right"}
    # Smaller x is assigned "Right" per the documented front-view heuristic.
    assert labels[0] == "Right"
    assert labels[1] == "Left"


def test_resolve_labels_single_hand_passthrough(flat_hand):
    assert resolve_labels([make_hand(flat_hand, "Left")]) == ["Left"]
