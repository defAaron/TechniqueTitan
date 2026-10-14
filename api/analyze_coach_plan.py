"""In-process coach plan payloads for photo and video analyze."""

from __future__ import annotations

import math
from typing import Any

from technique_titan.coach.focus import CRITERIA, FocusDecision
from technique_titan.coach.plan import CRITERION_METRICS, build_plan, plan_key
from technique_titan.coach.temporal import SmoothedCriterion, SmoothedHand
from technique_titan.coach.validate import validate_tip
from technique_titan.coaching import _lookup_tip, generate_coaching, metric_direction

from .schemas import COACH_CRITERIA, HandResultOut, HandSummaryOut, SessionDraftOut, VideoFrameScore


def _finite(value: float | None) -> bool:
    if value is None:
        return False
    return math.isfinite(value)


def _derive_severity(score: float) -> str:
    if score >= 80:
        return "good"
    if score >= 50:
        return "warning"
    return "critical"


def _direction_for_metric(value: float | None, ideal: list[float]) -> str:
    direction = metric_direction(value, ideal)
    if direction in ("too_low", "too_high"):
        return direction
    return "generic"


def _empty_focus() -> FocusDecision:
    return FocusDecision(
        focus_criterion=None,
        lock=None,
        burden={c: 0.0 for c in CRITERIA},
    )


def _ideals_from_scoring(scoring_config: dict) -> dict[str, list[float]]:
    criteria = scoring_config.get("criteria") or {}
    return {
        c: criteria[c]["ideal"]
        for c in COACH_CRITERIA
        if c in criteria and "ideal" in criteria[c]
    }


def _build_smoothed_hand(
    hand: str,
    scores: dict[str, float | None],
    severities: dict[str, str],
    metrics: dict[str, float | None],
    ideals: dict[str, list[float]],
) -> SmoothedHand:
    criteria: dict[str, SmoothedCriterion] = {}
    for criterion in COACH_CRITERIA:
        score = scores.get(criterion)
        if score is None or not _finite(score):
            continue
        sev_raw = severities.get(criterion)
        if sev_raw in ("good", "warning", "critical"):
            severity = sev_raw
        else:
            severity = _derive_severity(score)
        metric_name = CRITERION_METRICS[criterion]
        metric_val = metrics.get(metric_name)
        direction = _direction_for_metric(
            metric_val if _finite(metric_val) else None,
            ideals.get(criterion) or [],
        )
        criteria[criterion] = SmoothedCriterion(
            score=score,
            severity=severity,
            direction=direction,
        )
    return SmoothedHand(hand=hand, criteria=criteria)


def _fallback_problem_fix(
    scores: dict[str, float | None],
    severities: dict[str, str],
    metrics: dict[str, float | None],
    scoring_config: dict,
    coaching_config: dict,
) -> tuple[str | None, str | None]:
    report = generate_coaching(
        scores, severities, metrics, scoring_config, coaching_config
    )
    if report.primary:
        return report.primary.problem, report.primary.fix
    return None, None


def build_coach_plan_payload(
    *,
    hand: str,
    scores: dict[str, float | None],
    severities: dict[str, str],
    metrics: dict[str, float | None],
    scoring_config: dict,
    coaching_config: dict,
    tip_kind: str,
) -> dict[str, Any]:
    """Build coach_plan JSON for analyze responses (never raises)."""
    ideals = _ideals_from_scoring(scoring_config)
    focus = _empty_focus()
    smoothed = _build_smoothed_hand(hand, scores, severities, metrics, ideals)
    plan = build_plan(
        hand=hand,
        smoothed=smoothed,
        metrics=metrics,
        ideals=ideals,
        focus=focus,
        tip_kind=tip_kind,
        sessions=None,
    )

    if plan is None:
        return {
            "plan": None,
            "problem": None,
            "fix": None,
            "encouragement": coaching_config.get("encouragement"),
            "plan_key": None,
            "lock": None,
        }

    problem: str | None = None
    fix: str | None = None
    tip = _lookup_tip(
        coaching_config,
        plan["criterion"],
        plan["severity"],
        plan["direction"],
    )
    if tip is not None:
        errors = validate_tip(f"{tip.problem} {tip.fix}", plan)
        if not errors:
            problem, fix = tip.problem, tip.fix

    if problem is None or fix is None:
        problem, fix = _fallback_problem_fix(
            scores, severities, metrics, scoring_config, coaching_config
        )

    return {
        "plan": plan,
        "problem": problem,
        "fix": fix,
        "encouragement": None,
        "plan_key": plan_key(plan),
        "lock": None,
    }


def _pick_lower_composite_hand(hands: list[HandResultOut]) -> HandResultOut | None:
    if not hands:
        return None

    def sort_key(h: HandResultOut) -> tuple[int, float]:
        cs = h.composite_score
        if cs is None:
            return (1, 0.0)
        return (0, float(cs))

    return min(hands, key=sort_key)


def _pick_lower_composite_summary(hands: list[HandSummaryOut]) -> HandSummaryOut | None:
    if not hands:
        return None

    def sort_key(h: HandSummaryOut) -> tuple[int, float]:
        mc = h.mean_composite
        if mc is None:
            return (1, 0.0)
        return (0, float(mc))

    return min(hands, key=sort_key)


def _metrics_from_hand(hand: HandResultOut) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for key, raw in hand.criterion_metrics.items():
        if raw is None:
            out[key] = None
        elif isinstance(raw, float) and math.isnan(raw):
            out[key] = None
        else:
            try:
                out[key] = float(raw)
            except (TypeError, ValueError):
                out[key] = None
    return out


def _severities_from_mean_scores(
    mean_scores: dict[str, float | None],
) -> dict[str, str]:
    severities: dict[str, str] = {}
    for criterion in COACH_CRITERIA:
        raw = mean_scores.get(criterion)
        if raw is None or not _finite(raw):
            continue
        severities[criterion] = _derive_severity(raw)
    return severities


def coach_plan_for_photo_hands(
    hands: list[HandResultOut],
    scoring_config: dict,
    coaching_config: dict,
) -> dict[str, Any] | None:
    target = _pick_lower_composite_hand(hands)
    if target is None:
        return None
    return build_coach_plan_payload(
        hand=target.label.lower(),
        scores=target.scores,
        severities=target.severities,
        metrics=_metrics_from_hand(target),
        scoring_config=scoring_config,
        coaching_config=coaching_config,
        tip_kind="photo",
    )


def coach_plan_for_video(
    *,
    progress_draft: SessionDraftOut | None,
    frames: list[VideoFrameScore],
    scoring_config: dict,
    coaching_config: dict,
) -> dict[str, Any] | None:
    if progress_draft and progress_draft.hands:
        target = _pick_lower_composite_summary(progress_draft.hands)
        if target is None:
            return None
        return build_coach_plan_payload(
            hand=target.hand.lower(),
            scores=target.mean_scores,
            severities=_severities_from_mean_scores(target.mean_scores),
            metrics={},
            scoring_config=scoring_config,
            coaching_config=coaching_config,
            tip_kind="recap",
        )

    if not frames:
        return None
    last_hands = frames[-1].hands
    target = _pick_lower_composite_hand(last_hands)
    if target is None:
        return None
    return build_coach_plan_payload(
        hand=target.label.lower(),
        scores=target.scores,
        severities=target.severities,
        metrics=_metrics_from_hand(target),
        scoring_config=scoring_config,
        coaching_config=coaching_config,
        tip_kind="recap",
    )
