"""Focus criterion selection from recent session aggregates."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta

CRITERION_WEIGHTS: dict[str, float] = {
    "wrist_height": 0.25,
    "finger_curvature": 0.25,
    "thumb_position": 0.15,
    "wrist_lateral": 0.15,
    "hand_arch": 0.20,
}

CRITERIA: tuple[str, ...] = tuple(CRITERION_WEIGHTS.keys())


@dataclass(frozen=True)
class FocusSession:
    started_on: date
    mean_composite: float | None
    mean_scores: dict[str, float | None]
    frac_warning: dict[str, float]
    frac_critical: dict[str, float]
    primary_issue: str | None


@dataclass(frozen=True)
class LockedFocus:
    criterion: str
    locked_on: date
    locked_until: date
    burden: dict[str, float]


@dataclass(frozen=True)
class FocusDecision:
    focus_criterion: str | None
    lock: LockedFocus | None
    burden: dict[str, float]


def _frac_value(raw: float) -> float:
    if not math.isfinite(raw):
        return 0.0
    return raw


def _compute_burden(sessions: list[FocusSession]) -> dict[str, float]:
    n = len(sessions)
    if n == 0:
        return {c: 0.0 for c in CRITERIA}

    burden: dict[str, float] = {}
    for c in CRITERIA:
        rate_sum = 0.0
        hits = 0
        for s in sessions:
            fw = _frac_value(s.frac_warning.get(c, 0.0))
            fc = _frac_value(s.frac_critical.get(c, 0.0))
            rate_sum += fw + 2.0 * fc
            if s.primary_issue == c:
                hits += 1
        rate = rate_sum / n
        hit = hits / n
        burden[c] = 0.65 * rate + 0.35 * hit
    return burden


def _winner(burden: dict[str, float]) -> str:
    return sorted(CRITERIA, key=lambda c: (-burden[c], -CRITERION_WEIGHTS[c], c))[0]


def _lock_in_force(locked: LockedFocus | None, today: date) -> bool:
    if locked is None:
        return False
    if locked.criterion not in CRITERION_WEIGHTS:
        return False
    return today < locked.locked_until


def _early_completion(
    sessions: list[FocusSession],
    locked: LockedFocus,
) -> bool:
    ordered = sorted(sessions, key=lambda s: s.started_on)
    last_three = ordered[-3:]
    criterion = locked.criterion
    for s in last_three:
        score = s.mean_scores.get(criterion)
        if score is None or not math.isfinite(score) or score < 80:
            return False
    return True


def choose_focus(
    sessions: list[FocusSession],
    locked: LockedFocus | None,
    today: date,
) -> FocusDecision:
    n = len(sessions)
    burden = _compute_burden(sessions)

    if n < 3:
        return FocusDecision(focus_criterion=None, lock=None, burden=burden)

    active_lock = locked
    if _lock_in_force(active_lock, today) and active_lock is not None:
        if _early_completion(sessions, active_lock):
            active_lock = None

    if _lock_in_force(active_lock, today) and active_lock is not None:
        winner = _winner(burden)
        if (
            winner != active_lock.criterion
            and burden[winner] >= burden[active_lock.criterion] + 0.08
        ):
            new_lock = LockedFocus(
                criterion=winner,
                locked_on=today,
                locked_until=today + timedelta(days=7),
                burden=burden,
            )
            return FocusDecision(
                focus_criterion=winner,
                lock=new_lock,
                burden=burden,
            )
        kept = LockedFocus(
            criterion=active_lock.criterion,
            locked_on=active_lock.locked_on,
            locked_until=active_lock.locked_until,
            burden=burden,
        )
        return FocusDecision(
            focus_criterion=active_lock.criterion,
            lock=kept,
            burden=burden,
        )

    winner = _winner(burden)
    new_lock = LockedFocus(
        criterion=winner,
        locked_on=today,
        locked_until=today + timedelta(days=7),
        burden=burden,
    )
    return FocusDecision(focus_criterion=winner, lock=new_lock, burden=burden)
