"""Unit tests for in-process analyze coach_plan helper."""

from __future__ import annotations

from api.analyze_coach_plan import build_coach_plan_payload
from api.deps import get_coaching_config, get_scoring_config
from technique_titan.coaching import _lookup_tip


def test_build_coach_plan_payload_wrist_height_warning_too_high() -> None:
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

    expected = _lookup_tip(coaching, "wrist_height", "warning", "too_high")
    assert expected is not None
    assert payload["problem"] == expected.problem
    assert payload["fix"] == expected.fix
    assert payload["plan_key"] == "v1|right|wrist_height|warning|too_high|photo||"
