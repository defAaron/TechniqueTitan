"""Shared coach-plan shaping for analyze responses and /v1/coach/plan."""

from __future__ import annotations

import math

from technique_titan.coach.plan import CRITERION_METRICS
from technique_titan.coach.temporal import SmoothedCriterion, SmoothedHand
from technique_titan.coaching import metric_direction

from .schemas import COACH_CRITERIA


def is_finite(value: float | None) -> bool:
    if value is None:
        return False
    return math.isfinite(value)


def derive_severity(score: float) -> str:
    if score >= 80:
        return "good"
    if score >= 50:
        return "warning"
    return "critical"


def direction_for_metric(value: float | None, ideal: list[float]) -> str:
    direction = metric_direction(value, ideal)
    if direction in ("too_low", "too_high"):
        return direction
    return "generic"


def build_smoothed_hand(
    hand: str,
    scores: dict[str, float | None],
    severities: dict[str, str],
    metrics: dict[str, float | None],
    ideals: dict[str, list[float]],
) -> SmoothedHand:
    criteria: dict[str, SmoothedCriterion] = {}
    for criterion in COACH_CRITERIA:
        score = scores.get(criterion)
        if score is None or not is_finite(score):
            continue
        sev_raw = severities.get(criterion)
        if sev_raw in ("good", "warning", "critical"):
            severity = sev_raw
        else:
            severity = derive_severity(score)
        metric_name = CRITERION_METRICS[criterion]
        metric_val = metrics.get(metric_name)
        direction = direction_for_metric(
            metric_val if is_finite(metric_val) else None,
            ideals.get(criterion) or [],
        )
        criteria[criterion] = SmoothedCriterion(
            score=score,
            severity=severity,
            direction=direction,
        )
    return SmoothedHand(hand=hand, criteria=criteria)
