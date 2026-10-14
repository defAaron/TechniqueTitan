"""Pydantic request/response models for the analyze API."""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

COACH_CRITERIA = (
    "wrist_height",
    "finger_curvature",
    "thumb_position",
    "wrist_lateral",
    "hand_arch",
)

COACH_METRICS = (
    "wrist_height_delta",
    "mean_finger_curvature",
    "thumb_index_angle",
    "wrist_lateral_deviation_deg",
    "hand_arch_ratio",
)

CoachSeverity = Literal["good", "warning", "critical", "unknown"]
CoachHand = Literal["left", "right"]
CoachTipKind = Literal["live", "photo", "recap"]


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


class AnalyzeCoachPlanOut(BaseModel):
    plan: Optional[Dict[str, Any]] = None
    problem: Optional[str] = None
    fix: Optional[str] = None
    encouragement: Optional[str] = None
    plan_key: Optional[str] = None
    lock: Optional[Any] = None


class AnalyzeResponse(BaseModel):
    hands: List[HandResultOut]
    overlay_png_base64: Optional[str] = None
    message: Optional[str] = None
    progress_draft: Optional[SessionDraftOut] = None
    coach_plan: Optional[AnalyzeCoachPlanOut] = None


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
    coach_plan: Optional[AnalyzeCoachPlanOut] = None


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


class CoachPlanLockedFocusIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion: Literal[
        "wrist_height",
        "finger_curvature",
        "thumb_position",
        "wrist_lateral",
        "hand_arch",
    ]
    locked_on: date
    locked_until: date
    burden: Dict[str, float] = Field(default_factory=dict)


class CoachPlanHistoryHandIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hand: CoachHand
    mean_composite: Optional[float] = None
    mean_scores: Dict[str, Optional[float]] = Field(default_factory=dict)
    frac_warning: Dict[str, float] = Field(default_factory=dict)
    frac_critical: Dict[str, float] = Field(default_factory=dict)
    primary_issue: Optional[str] = None


class CoachPlanHistoryEntryIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    started_on: date
    hands: List[CoachPlanHistoryHandIn] = Field(..., min_length=1, max_length=2)


class CoachPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hand: CoachHand
    scores: Dict[
        Literal[
            "wrist_height",
            "finger_curvature",
            "thumb_position",
            "wrist_lateral",
            "hand_arch",
        ],
        Optional[float],
    ] = Field(default_factory=dict)
    severities: Dict[
        Literal[
            "wrist_height",
            "finger_curvature",
            "thumb_position",
            "wrist_lateral",
            "hand_arch",
        ],
        CoachSeverity,
    ] = Field(default_factory=dict)
    metrics: Dict[
        Literal[
            "wrist_height_delta",
            "mean_finger_curvature",
            "thumb_index_angle",
            "wrist_lateral_deviation_deg",
            "hand_arch_ratio",
        ],
        Optional[float],
    ] = Field(default_factory=dict)
    history: List[CoachPlanHistoryEntryIn] = Field(default_factory=list, max_length=40)
    tip_kind: CoachTipKind
    locked_focus: Optional[CoachPlanLockedFocusIn] = None

    @field_validator("scores", mode="before")
    @classmethod
    def validate_scores(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        import math

        out: dict = {}
        for key, raw in value.items():
            if raw is None:
                out[key] = None
                continue
            try:
                score = float(raw)
            except (TypeError, ValueError):
                raise ValueError("invalid score")
            if not math.isfinite(score):
                raise ValueError("non-finite score")
            if score < 0 or score > 100:
                raise ValueError("score out of range")
            out[key] = score
        return out

    @field_validator("metrics", mode="before")
    @classmethod
    def validate_metrics(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        import math

        out: dict = {}
        for key, raw in value.items():
            if raw is None:
                out[key] = None
                continue
            try:
                metric = float(raw)
            except (TypeError, ValueError):
                raise ValueError("invalid metric")
            if not math.isfinite(metric):
                raise ValueError("non-finite metric")
            out[key] = metric
        return out
