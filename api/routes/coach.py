"""Personalized coach plan (template renderer)."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from technique_titan.coach.focus import FocusSession, LockedFocus, choose_focus
from technique_titan.coach.plan import build_plan, plan_key
from technique_titan.coach.temporal import SmoothedCriterion, SmoothedHand
from technique_titan.coach.validate import validate_tip
from technique_titan.coaching import _lookup_tip, metric_direction

from ..deps import get_coaching_config, get_scoring_config
from ..schemas import COACH_CRITERIA, CoachPlanHistoryEntryIn, CoachPlanRequest

router = APIRouter(prefix="/v1", tags=["coach"])

_CRITERION_METRICS: dict[str, str] = {
    "wrist_height": "wrist_height_delta",
    "finger_curvature": "mean_finger_curvature",
    "thumb_position": "thumb_index_angle",
    "wrist_lateral": "wrist_lateral_deviation_deg",
    "hand_arch": "hand_arch_ratio",
}

_TEMPLATE_VALIDATION_DETAIL = "coaching template failed validation"


def _reject_non_finite(value: object) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise HTTPException(status_code=422, detail="Invalid request body")
    if isinstance(value, dict):
        for nested in value.values():
            _reject_non_finite(nested)
    elif isinstance(value, list):
        for nested in value:
            _reject_non_finite(nested)


def _finite(value: float | None) -> bool:
    if value is None:
        return False
    return math.isfinite(value)


def _frac_value(raw: float) -> float:
    if not math.isfinite(raw):
        return 0.0
    return raw


def _sanitize_primary_issue(raw: str | None) -> str | None:
    if raw is None or raw in ("../", "<script>"):
        return None
    if raw not in COACH_CRITERIA:
        return None
    return raw


def _filter_score_map(raw: dict[str, float | None]) -> dict[str, float | None]:
    out: dict[str, float | None] = {}
    for key in COACH_CRITERIA:
        if key not in raw:
            continue
        val = raw[key]
        if val is None or not math.isfinite(val):
            out[key] = None
        else:
            out[key] = val
    return out


def _filter_frac_map(raw: dict[str, float]) -> dict[str, float]:
    return {c: _frac_value(raw.get(c, 0.0)) for c in COACH_CRITERIA}


def _pick_history_hand(entry: CoachPlanHistoryEntryIn):
    hands = entry.hands
    if len(hands) == 1:
        return hands[0]

    def sort_key(h):
        mc = h.mean_composite
        if mc is None:
            return (1, 0.0)
        return (0, mc)

    return min(hands, key=sort_key)


def _collapse_history_entry(entry: CoachPlanHistoryEntryIn) -> FocusSession:
    hand = _pick_history_hand(entry)
    return FocusSession(
        started_on=entry.started_on,
        mean_composite=hand.mean_composite,
        mean_scores=_filter_score_map(hand.mean_scores),
        frac_warning=_filter_frac_map(hand.frac_warning),
        frac_critical=_filter_frac_map(hand.frac_critical),
        primary_issue=_sanitize_primary_issue(hand.primary_issue),
    )


def _filter_sessions(sessions: list[FocusSession], today) -> list[FocusSession]:
    cutoff = today - timedelta(days=14)
    in_window = [s for s in sessions if s.started_on >= cutoff]
    in_window.sort(key=lambda s: s.started_on, reverse=True)
    return in_window[:40]


def _locked_from_request(body: CoachPlanRequest) -> LockedFocus | None:
    raw = body.locked_focus
    if raw is None:
        return None
    burden = {c: float(raw.burden.get(c, 0.0)) for c in COACH_CRITERIA}
    return LockedFocus(
        criterion=raw.criterion,
        locked_on=raw.locked_on,
        locked_until=raw.locked_until,
        burden=burden,
    )


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


def _build_smoothed_hand(body: CoachPlanRequest, ideals: dict[str, list[float]]) -> SmoothedHand:
    criteria: dict[str, SmoothedCriterion] = {}
    for criterion in COACH_CRITERIA:
        score = body.scores.get(criterion)
        if score is None or not _finite(score):
            continue
        sev_raw = body.severities.get(criterion)
        if sev_raw in ("good", "warning", "critical"):
            severity = sev_raw
        else:
            severity = _derive_severity(score)
        metric_name = _CRITERION_METRICS[criterion]
        metric_val = body.metrics.get(metric_name)
        direction = _direction_for_metric(
            metric_val if _finite(metric_val) else None,
            ideals.get(criterion) or [],
        )
        criteria[criterion] = SmoothedCriterion(
            score=score,
            severity=severity,
            direction=direction,
        )
    return SmoothedHand(hand=body.hand, criteria=criteria)


def _lock_payload(lock: LockedFocus | None) -> dict | None:
    if lock is None:
        return None
    return {
        "criterion": lock.criterion,
        "locked_on": lock.locked_on.isoformat(),
        "locked_until": lock.locked_until.isoformat(),
        "burden": {c: lock.burden.get(c, 0.0) for c in COACH_CRITERIA},
    }


@router.post("/coach/plan")
async def coach_plan(request: Request) -> dict:
    try:
        raw = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid request body") from exc
    if not isinstance(raw, dict):
        raise HTTPException(status_code=422, detail="Invalid request body")
    _reject_non_finite(raw)
    try:
        body = CoachPlanRequest.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid request body") from exc

    today = datetime.now(timezone.utc).date()
    coaching_config = get_coaching_config()
    scoring_config = get_scoring_config()
    ideals = {
        c: scoring_config["criteria"][c]["ideal"]
        for c in COACH_CRITERIA
        if c in scoring_config.get("criteria", {})
    }

    collapsed = [_collapse_history_entry(entry) for entry in body.history]
    filtered_sessions = _filter_sessions(collapsed, today)
    locked = _locked_from_request(body)
    focus = choose_focus(filtered_sessions, locked, today)
    smoothed = _build_smoothed_hand(body, ideals)

    plan = build_plan(
        hand=body.hand,
        smoothed=smoothed,
        metrics=dict(body.metrics),
        ideals=ideals,
        focus=focus,
        tip_kind=body.tip_kind,
        sessions=filtered_sessions,
    )

    lock_json = _lock_payload(focus.lock)

    if plan is None:
        return {
            "plan": None,
            "problem": None,
            "fix": None,
            "encouragement": coaching_config.get("encouragement"),
            "plan_key": None,
            "lock": lock_json,
        }

    tip = _lookup_tip(
        coaching_config,
        plan["criterion"],
        plan["severity"],
        plan["direction"],
    )
    if tip is None:
        raise HTTPException(
            status_code=500,
            detail=_TEMPLATE_VALIDATION_DETAIL,
        )
    errors = validate_tip(f"{tip.problem} {tip.fix}", plan)
    if errors:
        raise HTTPException(
            status_code=500,
            detail=_TEMPLATE_VALIDATION_DETAIL,
        )

    return {
        "plan": plan,
        "problem": tip.problem,
        "fix": tip.fix,
        "encouragement": None,
        "plan_key": plan_key(plan),
        "lock": lock_json,
    }
