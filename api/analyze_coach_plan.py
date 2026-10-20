"""In-process coach plan payloads for photo and video analyze."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from technique_titan.coach.focus import CRITERIA, FocusDecision
from technique_titan.coach.plan import build_plan, plan_key
from technique_titan.coach.validate import validate_tip
from technique_titan.coaching import generate_coaching, lookup_variant

from .coach_shape import build_smoothed_hand, derive_severity, is_finite
from .schemas import COACH_CRITERIA, HandResultOut, SessionDraftOut, VideoFrameScore


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
    smoothed = build_smoothed_hand(hand, scores, severities, metrics, ideals)
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
    on = datetime.now(timezone.utc).date()
    tip = lookup_variant(
        coaching_config,
        plan["criterion"],
        plan["severity"],
        plan["direction"],
        user_id=None,
        plan_key=plan_key(plan),
        on=on,
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


def _pick_lower_score(items: list, score_of) -> Any | None:
    if not items:
        return None

    def sort_key(item) -> tuple[int, float]:
        score = score_of(item)
        if score is None:
            return (1, 0.0)
        return (0, float(score))

    return min(items, key=sort_key)


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
        if raw is None or not is_finite(raw):
            continue
        severities[criterion] = derive_severity(raw)
    return severities


def coach_plan_for_photo_hands(
    hands: list[HandResultOut],
    scoring_config: dict,
    coaching_config: dict,
) -> dict[str, Any] | None:
    target = _pick_lower_score(hands, lambda hand: hand.composite_score)
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
        target = _pick_lower_score(progress_draft.hands, lambda hand: hand.mean_composite)
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
    target = _pick_lower_score(last_hands, lambda hand: hand.composite_score)
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
