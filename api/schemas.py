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


class HandSummaryOut(BaseModel):
    hand: str
    frames_kept: int
    mean_composite: Optional[float] = None
    p10_composite: Optional[float] = None
    mean_scores: Dict[str, Optional[float]] = Field(default_factory=dict)
    frac_warning: Dict[str, float] = Field(default_factory=dict)
    frac_critical: Dict[str, float] = Field(default_factory=dict)
    primary_issue: Optional[str] = None
    tip_problem: Optional[str] = None
    tip_fix: Optional[str] = None


class SessionSampleOut(BaseModel):
    t_ms: int
    hand: str
    confidence: float
    composite: Optional[float] = None
    scores: Dict[str, Optional[float]] = Field(default_factory=dict)
    severities: Dict[str, str] = Field(default_factory=dict)


class SessionDraftOut(BaseModel):
    source: str
    duration_s: float
    frames_seen: int
    frames_kept: int
    scoring_version: str
    hands: List[HandSummaryOut] = Field(default_factory=list)
    samples: List[SessionSampleOut] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    hands: List[HandResultOut]
    overlay_png_base64: Optional[str] = None
    message: Optional[str] = None
    progress_draft: Optional[SessionDraftOut] = None


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
    fps: float = 0.0
    message: Optional[str] = None
    progress_draft: Optional[SessionDraftOut] = None


class ProgressTickIn(BaseModel):
    t_ms: int = Field(..., ge=0)
    hand: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    composite_score: Optional[float] = None
    scores: Dict[str, Optional[float]] = Field(default_factory=dict)
    severities: Dict[str, str] = Field(default_factory=dict)
    coaching: Optional[CoachingOut] = None


class ReduceProgressRequest(BaseModel):
    source: str = Field(..., pattern="^(live|photo|video)$")
    duration_s: float = Field(default=0.0, ge=0.0)
    frames_seen: int = Field(default=0, ge=0)
    ticks: List[ProgressTickIn] = Field(default_factory=list)


class PublicConfigResponse(BaseModel):
    criterion_labels: Dict[str, str]
    modes: List[str]
