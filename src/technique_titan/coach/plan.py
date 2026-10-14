"""Coach plan selection from smoothed scores and focus."""

from __future__ import annotations

import math

from technique_titan.coach.focus import CRITERIA, CRITERION_WEIGHTS, FocusDecision, FocusSession
from technique_titan.coach.temporal import SmoothedHand

CRITERION_METRICS: dict[str, str] = {
    "wrist_height": "wrist_height_delta",
    "finger_curvature": "mean_finger_curvature",
    "thumb_position": "thumb_index_angle",
    "wrist_lateral": "wrist_lateral_deviation_deg",
    "hand_arch": "hand_arch_ratio",
}

_SEVERITY_RANK = {"critical": 2, "warning": 1}


def _finite(value: float | None) -> bool:
    if value is None:
        return False
    return math.isfinite(value)


def _usable_score(sc_score: float | None) -> bool:
    return _finite(sc_score)


def _known_severity(severity: str) -> bool:
    return severity in ("good", "warning", "critical")


def _should_return_none(smoothed: SmoothedHand) -> bool:
    for c in CRITERIA:
        sc = smoothed.criteria.get(c)
        if sc is None:
            continue
        if not _known_severity(sc.severity):
            continue
        if not _usable_score(sc.score):
            continue
        if sc.severity != "good":
            return False
    return True


def _pick_acute(focus_criterion: str | None, smoothed: SmoothedHand) -> str | None:
    candidates: list[str] = []
    for c in CRITERIA:
        if c == focus_criterion:
            continue
        sc = smoothed.criteria.get(c)
        if sc is None or sc.severity != "critical":
            continue
        if not _known_severity(sc.severity):
            continue
        if not _usable_score(sc.score):
            continue
        candidates.append(c)
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda name: (-CRITERION_WEIGHTS[name], CRITERIA.index(name)),
    )[0]


def _pick_worst_non_good(smoothed: SmoothedHand) -> str | None:
    candidates: list[str] = []
    for c in CRITERIA:
        sc = smoothed.criteria.get(c)
        if sc is None or not _known_severity(sc.severity):
            continue
        if sc.severity == "good":
            continue
        if not _usable_score(sc.score):
            continue
        candidates.append(c)
    if not candidates:
        return None
    return sorted(
        candidates,
        key=lambda name: (
            -_SEVERITY_RANK[smoothed.criteria[name].severity],
            -CRITERION_WEIGHTS[name],
            CRITERIA.index(name),
        ),
    )[0]


def _choose_criterion(
    *,
    acute: str | None,
    focus_criterion: str | None,
    smoothed: SmoothedHand,
) -> str | None:
    if acute is not None:
        return acute
    if focus_criterion is not None:
        sc = smoothed.criteria.get(focus_criterion)
        if (
            sc is not None
            and _known_severity(sc.severity)
            and sc.severity != "good"
            and _usable_score(sc.score)
        ):
            return focus_criterion
    return _pick_worst_non_good(smoothed)


def _plan_direction(direction: str) -> str:
    if direction in ("too_low", "too_high"):
        return direction
    return "generic"


def _plan_score(score: float | None) -> int:
    if not _usable_score(score):
        return 0
    assert score is not None
    clamped = max(0.0, min(100.0, score))
    return int(math.floor(clamped + 0.5))


def _trend_delta(sessions: list[FocusSession] | None, criterion: str) -> float | None:
    if not sessions or len(sessions) < 6:
        return None
    ordered = sorted(sessions, key=lambda s: s.started_on, reverse=True)

    def group_mean(indices: range) -> float | None:
        values: list[float] = []
        for i in indices:
            raw = ordered[i].mean_scores.get(criterion)
            if _finite(raw):
                values.append(raw)  # type: ignore[arg-type]
        if len(values) != len(indices):
            return None
        return sum(values) / len(values)

    recent = group_mean(range(3))
    prior = group_mean(range(3, 6))
    if recent is None or prior is None:
        return None
    return recent - prior


def build_plan(
    *,
    hand: str,
    smoothed: SmoothedHand,
    metrics: dict[str, float | None],
    ideals: dict[str, list[float]],
    focus: FocusDecision,
    tip_kind: str,
    sessions: list[FocusSession] | None = None,
) -> dict | None:
    if _should_return_none(smoothed):
        return None

    acute = _pick_acute(focus.focus_criterion, smoothed)
    chosen = _choose_criterion(
        acute=acute,
        focus_criterion=focus.focus_criterion,
        smoothed=smoothed,
    )
    if chosen is None:
        return None

    sc = smoothed.criteria[chosen]
    if sc.severity not in ("warning", "critical"):
        return None

    metric_name = CRITERION_METRICS[chosen]
    raw_metric = metrics.get(metric_name)
    metric_value = raw_metric if _finite(raw_metric) else None

    return {
        "version": 1,
        "hand": hand,
        "focus_criterion": focus.focus_criterion,
        "acute_criterion": acute,
        "criterion": chosen,
        "severity": sc.severity,
        "direction": _plan_direction(sc.direction),
        "score": _plan_score(sc.score),
        "metric_name": metric_name,
        "metric_value": metric_value,
        "ideal": ideals.get(chosen) or [],
        "trend_delta": _trend_delta(sessions, chosen),
        "sessions_in_window": len(sessions or []),
        "tip_kind": tip_kind,
        "renderer": "template",
    }


def plan_key(plan: dict) -> str:
    focus = plan.get("focus_criterion") or ""
    acute = plan.get("acute_criterion") or ""
    return (
        f"v1|{plan['hand']}|{plan['criterion']}|{plan['severity']}|"
        f"{plan['direction']}|{plan['tip_kind']}|{focus}|{acute}"
    )
