"""Tests for coach plan selection and plan_key."""

from __future__ import annotations

import math
from datetime import date, timedelta

import pytest

from technique_titan.coach.focus import FocusDecision, FocusSession
from technique_titan.coach.plan import build_plan, plan_key
from technique_titan.coach.temporal import SmoothedCriterion, SmoothedHand

TODAY = date(2026, 10, 13)
CRITERIA = (
    "wrist_height",
    "finger_curvature",
    "thumb_position",
    "wrist_lateral",
    "hand_arch",
)
METRICS = {
    "wrist_height": "wrist_height_delta",
    "finger_curvature": "mean_finger_curvature",
    "thumb_position": "thumb_index_angle",
    "wrist_lateral": "wrist_lateral_deviation_deg",
    "hand_arch": "hand_arch_ratio",
}


def _criterion(
    *,
    score: float | None = 70.0,
    severity: str = "warning",
    direction: str = "too_low",
) -> SmoothedCriterion:
    return SmoothedCriterion(score=score, severity=severity, direction=direction)


def _hand(
    hand: str = "right",
    overrides: dict[str, SmoothedCriterion] | None = None,
) -> SmoothedHand:
    base = {c: _criterion(severity="good", score=90.0, direction="in_ideal") for c in CRITERIA}
    if overrides:
        base.update(overrides)
    return SmoothedHand(hand=hand, criteria=base)


def _focus(focus_criterion: str | None = None) -> FocusDecision:
    return FocusDecision(
        focus_criterion=focus_criterion,
        lock=None,
        burden={c: 0.0 for c in CRITERIA},
    )


def _session(
    started_on: date,
    *,
    mean_scores: dict[str, float | None] | None = None,
) -> FocusSession:
    return FocusSession(
        started_on=started_on,
        mean_composite=None,
        mean_scores=mean_scores or {},
        frac_warning={},
        frac_critical={},
        primary_issue=None,
    )


def test_all_good_returns_none() -> None:
    plan = build_plan(
        hand="right",
        smoothed=_hand(),
        metrics={},
        ideals={},
        focus=_focus("wrist_height"),
        tip_kind="live",
    )
    assert plan is None


def test_acute_critical_beats_focus_warning() -> None:
    smoothed = _hand(
        overrides={
            "wrist_height": _criterion(severity="warning", score=55.0, direction="too_high"),
            "finger_curvature": _criterion(severity="critical", score=30.0, direction="too_low"),
        },
    )
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={"mean_finger_curvature": 0.5},
        ideals={"finger_curvature": [0.6, 0.9]},
        focus=_focus("wrist_height"),
        tip_kind="live",
    )
    assert plan is not None
    assert plan["focus_criterion"] == "wrist_height"
    assert plan["acute_criterion"] == "finger_curvature"
    assert plan["criterion"] == "finger_curvature"
    assert plan["severity"] == "critical"
    assert plan["direction"] == "too_low"


def test_plan_key_acute_and_focus() -> None:
    plan = {
        "version": 1,
        "hand": "right",
        "focus_criterion": "wrist_height",
        "acute_criterion": "finger_curvature",
        "criterion": "finger_curvature",
        "severity": "critical",
        "direction": "too_low",
        "score": 30,
        "metric_name": "mean_finger_curvature",
        "metric_value": 0.5,
        "ideal": [],
        "trend_delta": None,
        "sessions_in_window": 0,
        "tip_kind": "live",
        "renderer": "template",
    }
    assert plan_key(plan) == (
        "v1|right|finger_curvature|critical|too_low|live|wrist_height|finger_curvature"
    )


def test_focus_good_worst_hand_arch_warning() -> None:
    smoothed = _hand(
        overrides={
            "wrist_height": _criterion(severity="good", score=85.0, direction="in_ideal"),
            "hand_arch": _criterion(severity="warning", score=60.0, direction="generic"),
        },
    )
    plan = build_plan(
        hand="left",
        smoothed=smoothed,
        metrics={"hand_arch_ratio": 0.4},
        ideals={"hand_arch": [0.5, 0.8]},
        focus=_focus("wrist_height"),
        tip_kind="photo",
    )
    assert plan is not None
    assert plan["acute_criterion"] is None
    assert plan["criterion"] == "hand_arch"
    assert plan["severity"] == "warning"
    assert plan["direction"] == "generic"
    key = plan_key(plan)
    assert key.endswith("|wrist_height|")


def test_no_focus_higher_weight_wrist_height() -> None:
    smoothed = _hand(
        overrides={
            "wrist_height": _criterion(severity="warning", score=55.0, direction="too_high"),
            "thumb_position": _criterion(severity="warning", score=58.0, direction="too_low"),
        },
    )
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={},
        ideals={},
        focus=_focus(None),
        tip_kind="live",
    )
    assert plan is not None
    assert plan["criterion"] == "wrist_height"
    assert plan["focus_criterion"] is None


def test_trend_delta_six_sessions() -> None:
    criterion = "finger_curvature"
    metric = METRICS[criterion]
    smoothed = _hand(
        overrides={
            criterion: _criterion(severity="warning", score=65.0, direction="too_low"),
        },
    )
    # Newest first after sort: days 0,1,2 → 70,60,50; older 3,4,5 → 80,80,80
    score_by_age = {0: 70.0, 1: 60.0, 2: 50.0, 3: 80.0, 4: 80.0, 5: 80.0}
    sessions = [
        _session(TODAY - timedelta(days=days), mean_scores={criterion: score_by_age[days]})
        for days in range(6)
    ]
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={metric: 1.0},
        ideals={criterion: [0.5, 0.9]},
        focus=_focus(None),
        tip_kind="live",
        sessions=sessions,
    )
    assert plan is not None
    assert plan["sessions_in_window"] == 6
    assert plan["trend_delta"] == pytest.approx(-20.0)


def test_trend_delta_fewer_than_six_is_null() -> None:
    criterion = "wrist_height"
    smoothed = _hand(
        overrides={
            criterion: _criterion(severity="warning", score=55.0, direction="too_low"),
        },
    )
    sessions = [
        _session(TODAY - timedelta(days=i), mean_scores={criterion: 70.0 - i})
        for i in range(5)
    ]
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={},
        ideals={},
        focus=_focus(None),
        tip_kind="live",
        sessions=sessions,
    )
    assert plan is not None
    assert plan["trend_delta"] is None
    assert plan["sessions_in_window"] == 5


def test_non_finite_score_skipped_nan_metric_none() -> None:
    smoothed = _hand(
        overrides={
            "wrist_height": _criterion(severity="critical", score=float("nan"), direction="too_low"),
            "hand_arch": _criterion(severity="warning", score=55.0, direction="too_high"),
        },
    )
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={"hand_arch_ratio": float("nan"), "wrist_height_delta": 1.0},
        ideals={},
        focus=_focus(None),
        tip_kind="live",
    )
    assert plan is not None
    assert plan["criterion"] == "hand_arch"
    assert plan["metric_value"] is None
    assert not math.isfinite(smoothed.criteria["wrist_height"].score or 0)


def test_nonfinite_focus_score_falls_through_to_other_issue() -> None:
    smoothed = _hand(
        overrides={
            "wrist_height": _criterion(severity="warning", score=float("nan"), direction="too_low"),
            "hand_arch": _criterion(severity="warning", score=60.0, direction="too_high"),
        },
    )
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={},
        ideals={},
        focus=_focus("wrist_height"),
        tip_kind="live",
    )
    assert plan is not None
    assert plan["criterion"] == "hand_arch"
    assert plan["focus_criterion"] == "wrist_height"
    assert plan["acute_criterion"] is None


def test_renderer_template_score_is_int() -> None:
    smoothed = _hand(
        overrides={
            "finger_curvature": _criterion(severity="warning", score=62.7, direction="unknown"),
        },
    )
    plan = build_plan(
        hand="right",
        smoothed=smoothed,
        metrics={"mean_finger_curvature": 0.3},
        ideals={},
        focus=_focus(None),
        tip_kind="live",
    )
    assert plan is not None
    assert plan["renderer"] == "template"
    assert plan["score"] == 63
    assert isinstance(plan["score"], int)
    assert plan["direction"] == "generic"
