"""Pydantic request/response models for the analyze API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


CRITERION_LABELS = {
    "wrist_height": "Wrist height",
    "finger_curvature": "Finger curvature",
    "thumb_position": "Thumb position",
    "wrist_lateral": "Wrist lateral deviation",
    "hand_arch": "Overall hand arch",
}


class CoachingTipOut(BaseModel):
    criterion: str
    severity: str
    direction: str
    problem: str
    fix: str
    priority: int


class CoachingOut(BaseModel):
    tips: List[CoachingTipOut] = Field(default_factory=list)
    primary: Optional[CoachingTipOut] = None
    encouragement: Optional[str] = None


class HandResultOut(BaseModel):
    label: str
    handedness: str
    confidence: float
    scores: Dict[str, Optional[float]]
    severities: Dict[str, str]
    composite_score: Optional[float]
    composite_severity: str
    criterion_metrics: Dict[str, Any]
    coaching: CoachingOut
    landmarks: List[List[float]]


class AnalyzeResponse(BaseModel):
    hands: List[HandResultOut]
    overlay_png_base64: Optional[str] = None
    message: Optional[str] = None


class LandmarkHandIn(BaseModel):
    """One hand's landmarks from browser MediaPipe (normalized x,y,z)."""

    landmarks: List[List[float]] = Field(
        ..., description="21x3 image-normalized landmarks"
    )
    world_landmarks: Optional[List[List[float]]] = None
    handedness: str = Field(..., pattern="^(Left|Right)$")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class ScoreLandmarksRequest(BaseModel):
    hands: List[LandmarkHandIn]
    include_overlay: bool = False
    # Optional reference image size for overlay drawing (normalized coords).
    image_width: int = Field(default=640, ge=64, le=4096)
    image_height: int = Field(default=480, ge=64, le=4096)


class VideoFrameScore(BaseModel):
    frame_index: int
    hands: List[HandResultOut]


class VideoAnalyzeResponse(BaseModel):
    frames: List[VideoFrameScore]
    timeline: Dict[str, List[Optional[float]]]
    message: Optional[str] = None


class PublicConfigResponse(BaseModel):
    criterion_labels: Dict[str, str]
    modes: List[str]
