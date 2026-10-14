"""Tests for personalized coach focus selection."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from technique_titan.coach.focus import (
    CRITERION_WEIGHTS,
    FocusSession,
    LockedFocus,
    choose_focus,
)
from technique_titan.scoring import load_config

TODAY = date(2026, 10, 13)
CRITERIA = (
    "wrist_height",
    "finger_curvature",
    "thumb_position",
    "wrist_lateral",
    "hand_arch",
)


def _session(
    started_on: date,
    *,
    primary_issue: str | None = None,
    frac_warning: dict[str, float] | None = None,
    frac_critical: dict[str, float] | None = None,
    mean_scores: dict[str, float | None] | None = None,
) -> FocusSession:
    return FocusSession(
        started_on=started_on,
        mean_composite=None,
        mean_scores=mean_scores or {},
        frac_warning=frac_warning or {},
        frac_critical=frac_critical or {},
        primary_issue=primary_issue,
    )


def _zero_burden() -> dict[str, float]:
    return {c: 0.0 for c in CRITERIA}


def test_empty_sessions() -> None:
    decision = choose_focus([], locked=None, today=TODAY)
    assert decision.focus_criterion is None
    assert decision.lock is None
    assert decision.burden == _zero_burden()


def test_two_sessions_insufficient_even_with_lock() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=1),
            frac_critical={"finger_curvature": 1.0},
            primary_issue="finger_curvature",
        ),
        _session(
            TODAY - timedelta(days=2),
            frac_critical={"finger_curvature": 1.0},
            primary_issue="finger_curvature",
        ),
    ]
    locked = LockedFocus(
        criterion="thumb_position",
        locked_on=TODAY - timedelta(days=3),
        locked_until=TODAY + timedelta(days=4),
        burden={},
    )
    decision = choose_focus(sessions, locked=locked, today=TODAY)
    assert decision.focus_criterion is None
    assert decision.lock is None


def test_three_sessions_obvious_winner_new_lock() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=i),
            primary_issue="finger_curvature",
            frac_critical={"finger_curvature": 1.0},
        )
        for i in (1, 2, 3)
    ]
    decision = choose_focus(sessions, locked=None, today=TODAY)
    assert decision.burden["finger_curvature"] == pytest.approx(1.65)
    assert decision.focus_criterion == "finger_curvature"
    assert decision.lock is not None
    assert decision.lock.criterion == "finger_curvature"
    assert decision.lock.locked_on == TODAY
    assert decision.lock.locked_until == TODAY + timedelta(days=7)


def test_tie_burden_higher_weight_wins() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=i),
            primary_issue="not_a_criterion",
            frac_warning={"finger_curvature": 1.0, "thumb_position": 1.0},
        )
        for i in (1, 2, 3)
    ]
    decision = choose_focus(sessions, locked=None, today=TODAY)
    assert decision.burden["finger_curvature"] == pytest.approx(0.65)
    assert decision.burden["thumb_position"] == pytest.approx(0.65)
    assert decision.focus_criterion == "finger_curvature"


def test_same_weight_name_tie_finger_curvature() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=i),
            primary_issue="../",
            frac_warning={"wrist_height": 1.0, "finger_curvature": 1.0},
        )
        for i in (1, 2, 3)
    ]
    decision = choose_focus(sessions, locked=None, today=TODAY)
    assert decision.focus_criterion == "finger_curvature"


def test_unknown_primary_issue_never_returned() -> None:
    sessions = [
        _session(TODAY - timedelta(days=i), primary_issue="<script>")
        for i in (1, 2, 3)
    ]
    decision = choose_focus(sessions, locked=None, today=TODAY)
    assert decision.focus_criterion == "finger_curvature"
    assert decision.focus_criterion != "<script>"


def test_hysteresis_stay_below_switch_threshold() -> None:
    sessions = [
        _session(TODAY - timedelta(days=5), primary_issue="thumb_position"),
        _session(TODAY - timedelta(days=4), primary_issue="thumb_position"),
        _session(
            TODAY - timedelta(days=3),
            primary_issue="finger_curvature",
            mean_scores={"thumb_position": 50.0},
        ),
        _session(TODAY - timedelta(days=2), primary_issue="finger_curvature"),
        _session(TODAY - timedelta(days=1), primary_issue="finger_curvature"),
    ]
    locked = LockedFocus(
        criterion="thumb_position",
        locked_on=TODAY - timedelta(days=3),
        locked_until=TODAY + timedelta(days=4),
        burden={},
    )
    decision = choose_focus(sessions, locked=locked, today=TODAY)
    assert decision.burden["finger_curvature"] == pytest.approx(0.21)
    assert decision.burden["thumb_position"] == pytest.approx(0.14)
    assert decision.focus_criterion == "thumb_position"
    assert decision.lock is not None
    assert decision.lock.locked_on == TODAY - timedelta(days=3)
    assert decision.lock.locked_until == TODAY + timedelta(days=4)


def test_hysteresis_switch_at_least_point_zero_eight() -> None:
    base = TODAY - timedelta(days=10)
    sessions = [
        _session(
            base + timedelta(days=i),
            primary_issue=None,
            frac_warning={"finger_curvature": 1.0} if i == 0 else {},
            mean_scores={"thumb_position": 50.0},
        )
        for i in range(8)
    ]
    locked = LockedFocus(
        criterion="thumb_position",
        locked_on=TODAY - timedelta(days=3),
        locked_until=TODAY + timedelta(days=4),
        burden={},
    )
    decision = choose_focus(sessions, locked=locked, today=TODAY)
    assert decision.burden["finger_curvature"] == pytest.approx(0.08125)
    assert decision.focus_criterion == "finger_curvature"
    assert decision.lock is not None
    assert decision.lock.locked_on == TODAY
    assert decision.lock.locked_until == TODAY + timedelta(days=7)


def test_early_completion_clears_lock_and_recomputes() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=10),
            mean_scores={"finger_curvature": 10.0},
        ),
        _session(
            TODAY - timedelta(days=3),
            mean_scores={"finger_curvature": 80.0},
        ),
        _session(
            TODAY - timedelta(days=2),
            mean_scores={"finger_curvature": 85.0},
        ),
        _session(
            TODAY - timedelta(days=1),
            mean_scores={"finger_curvature": 90.0},
        ),
    ]
    locked = LockedFocus(
        criterion="finger_curvature",
        locked_on=TODAY - timedelta(days=3),
        locked_until=TODAY + timedelta(days=4),
        burden={},
    )
    decision = choose_focus(sessions, locked=locked, today=TODAY)
    assert decision.focus_criterion == "finger_curvature"
    assert decision.lock is not None
    assert decision.lock.locked_on == TODAY
    assert decision.lock.locked_until == TODAY + timedelta(days=7)


def test_expired_lock_creates_new_lock() -> None:
    sessions = [
        _session(
            TODAY - timedelta(days=i),
            primary_issue="finger_curvature",
            frac_critical={"finger_curvature": 1.0},
        )
        for i in (1, 2, 3)
    ]
    locked = LockedFocus(
        criterion="thumb_position",
        locked_on=TODAY - timedelta(days=10),
        locked_until=TODAY,
        burden={},
    )
    decision = choose_focus(sessions, locked=locked, today=TODAY)
    assert decision.focus_criterion == "finger_curvature"
    assert decision.lock is not None
    assert decision.lock.locked_on == TODAY
    assert decision.lock.locked_until == TODAY + timedelta(days=7)


def test_no_internal_date_window_filter() -> None:
    sessions = [
        _session(
            date(2020, 1, i),
            primary_issue="finger_curvature",
            frac_critical={"finger_curvature": 1.0},
        )
        for i in (1, 2, 3)
    ]
    decision = choose_focus(sessions, locked=None, today=TODAY)
    assert decision.focus_criterion is not None


def test_module_weights_match_scoring_yaml() -> None:
    cfg = load_config()
    for name in CRITERIA:
        assert CRITERION_WEIGHTS[name] == cfg["criteria"][name]["weight"]
