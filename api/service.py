"""Business logic: decode images, run analysis, serialize results."""

from __future__ import annotations

import base64
import tempfile
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

from technique_titan.analysis import (
    AnalysisResult,
    analyze_hands,
    draw_all_overlays,
    score_detected_hands,
)
from technique_titan.coaching import annotate_with_coaching, generate_coaching
from technique_titan.detection import HandDetection, HandDetector

from .schemas import (
    AnalyzeResponse,
    CoachingOut,
    CoachingTipOut,
    HandResultOut,
    LandmarkHandIn,
    VideoAnalyzeResponse,
    VideoFrameScore,
)


def decode_image_bytes(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image bytes")
    return image


def encode_png_base64(image_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", image_bgr)
    if not ok:
        raise ValueError("Could not encode overlay PNG")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _coaching_out(
    result: AnalysisResult, scoring_config: dict, coaching_config: dict
) -> CoachingOut:
    report = generate_coaching(
        result.scores,
        result.severities,
        result.criterion_metrics,
        scoring_config,
        coaching_config,
    )

    def tip_out(tip) -> CoachingTipOut:
        return CoachingTipOut(
            criterion=tip.criterion,
            severity=tip.severity,
            direction=tip.direction,
            problem=tip.problem,
            fix=tip.fix,
            priority=tip.priority,
        )

    return CoachingOut(
        tips=[tip_out(t) for t in report.tips],
        primary=tip_out(report.primary) if report.primary else None,
        encouragement=report.encouragement,
    )


def serialize_hand(
    result: AnalysisResult, scoring_config: dict, coaching_config: dict
) -> HandResultOut:
    metrics = {
        k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else float(v))
        for k, v in result.criterion_metrics.items()
    }
    return HandResultOut(
        label=result.label,
        handedness=result.hand.handedness,
        confidence=float(result.hand.confidence),
        scores=result.scores,
        severities=result.severities,
        composite_score=result.composite_score,
        composite_severity=result.composite_severity,
        criterion_metrics=metrics,
        coaching=_coaching_out(result, scoring_config, coaching_config),
        landmarks=result.hand.landmarks.round(6).tolist(),
    )


def analyze_image_bgr(
    image_bgr: np.ndarray,
    detector: HandDetector,
    scoring_config: dict,
    coaching_config: dict,
    *,
    include_overlay: bool = True,
) -> AnalyzeResponse:
    results = analyze_hands(image_bgr, detector, scoring_config)
    if not results:
        return AnalyzeResponse(
            hands=[],
            overlay_png_base64=(
                encode_png_base64(image_bgr) if include_overlay else None
            ),
            message="No hand detected. Try a clearer, well-lit image with the hand fully visible.",
        )

    overlay_b64 = None
    if include_overlay:
        annotated = annotate_with_coaching(
            image_bgr, results, scoring_config, coaching_config, draw_all_overlays
        )
        overlay_b64 = encode_png_base64(annotated)

    return AnalyzeResponse(
        hands=[serialize_hand(r, scoring_config, coaching_config) for r in results],
        overlay_png_base64=overlay_b64,
    )


def landmark_hand_to_detection(hand: LandmarkHandIn) -> HandDetection:
    landmarks = np.asarray(hand.landmarks, dtype=float)
    if landmarks.shape != (21, 3):
        raise ValueError("Each hand must provide landmarks with shape (21, 3)")
    world = None
    if hand.world_landmarks is not None:
        world = np.asarray(hand.world_landmarks, dtype=float)
        if world.shape != (21, 3):
            raise ValueError("world_landmarks must have shape (21, 3)")
    return HandDetection(
        landmarks=landmarks,
        world_landmarks=world,
        handedness=hand.handedness,
        confidence=float(hand.confidence),
    )


def score_landmark_hands(
    hands_in: List[LandmarkHandIn],
    scoring_config: dict,
    coaching_config: dict,
    *,
    include_overlay: bool = False,
    image_width: int = 640,
    image_height: int = 480,
) -> AnalyzeResponse:
    detections = [landmark_hand_to_detection(h) for h in hands_in]
    results = score_detected_hands(detections, scoring_config)
    if not results:
        return AnalyzeResponse(hands=[], message="No hands provided.")

    overlay_b64 = None
    if include_overlay:
        blank = np.zeros((image_height, image_width, 3), dtype=np.uint8)
        annotated = annotate_with_coaching(
            blank, results, scoring_config, coaching_config, draw_all_overlays
        )
        overlay_b64 = encode_png_base64(annotated)

    return AnalyzeResponse(
        hands=[serialize_hand(r, scoring_config, coaching_config) for r in results],
        overlay_png_base64=overlay_b64,
    )


def analyze_video_bytes(
    data: bytes,
    scoring_config: dict,
    coaching_config: dict,
    *,
    stride: int = 5,
    max_frames: int = 120,
    suffix: str = ".mp4",
) -> VideoAnalyzeResponse:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        path = tmp.name

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        Path(path).unlink(missing_ok=True)
        raise ValueError("Could not open video file")

    frames_out: List[VideoFrameScore] = []
    timeline: dict[str, list[Optional[float]]] = {}
    frame_idx = 0
    analyzed = 0

    try:
        with HandDetector(static_image_mode=False) as detector:
            while analyzed < max_frames:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_idx % stride == 0:
                    results = analyze_hands(frame, detector, scoring_config)
                    hands = [
                        serialize_hand(r, scoring_config, coaching_config)
                        for r in results
                    ]
                    frames_out.append(
                        VideoFrameScore(frame_index=frame_idx, hands=hands)
                    )
                    for r in results:
                        timeline.setdefault(r.label, []).append(r.composite_score)
                    analyzed += 1
                frame_idx += 1
    finally:
        cap.release()
        Path(path).unlink(missing_ok=True)

    if not frames_out:
        return VideoAnalyzeResponse(
            frames=[],
            timeline={},
            message="No frames could be analyzed from that video.",
        )

    return VideoAnalyzeResponse(frames=frames_out, timeline=timeline)
