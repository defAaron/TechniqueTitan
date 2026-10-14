"""Unit tests for in-process analyze coach_plan helper."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

import api.analyze_coach_plan as analyze_coach_plan_mod
from api.analyze_coach_plan import build_coach_plan_payload
from api.deps import get_coaching_config, get_scoring_config
from technique_titan.coach.plan import plan_key
from technique_titan.coaching import lookup_variant

_FROZEN_TODAY = date(2026, 10, 13)


@pytest.fixture
def frozen_utc_today(monkeypatch: pytest.MonkeyPatch) -> date:
    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 10, 13, 12, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(analyze_coach_plan_mod, "datetime", FrozenDateTime)
    return _FROZEN_TODAY


def test_build_coach_plan_payload_wrist_height_warning_too_high(
    frozen_utc_today: date,
) -> None:
    scoring = get_scoring_config()
    coaching = get_coaching_config()
    scores = {
        "wrist_height": 60.0,
        "finger_curvature": 90.0,
        "thumb_position": 90.0,
        "wrist_lateral": 90.0,
        "hand_arch": 90.0,
    }
    severities = {
        "wrist_height": "warning",
        "finger_curvature": "good",
        "thumb_position": "good",
        "wrist_lateral": "good",
        "hand_arch": "good",
    }
    metrics = {"wrist_height_delta": 1.12}

    payload = build_coach_plan_payload(
        hand="right",
        scores=scores,
        severities=severities,
        metrics=metrics,
        scoring_config=scoring,
        coaching_config=coaching,
        tip_kind="photo",
    )

    plan = payload["plan"]
    assert plan is not None
    assert plan["criterion"] == "wrist_height"
    assert plan["severity"] == "warning"
    assert plan["direction"] == "too_high"
    assert plan["renderer"] == "template"

    pk = plan_key(plan)
    expected = lookup_variant(
        coaching,
        plan["criterion"],
        plan["severity"],
        plan["direction"],
        user_id=None,
        plan_key=pk,
        on=frozen_utc_today,
    )
    assert expected is not None
    assert payload["problem"] == expected.problem
    assert payload["fix"] == expected.fix
    assert payload["plan_key"] == "v1|right|wrist_height|warning|too_high|photo||"
