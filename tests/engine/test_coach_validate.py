"""Tests for coach tip string validation (spec §3.3)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from technique_titan.coach.validate import validate_tip
from technique_titan.coaching import load_coaching_config

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "coach_validator_cases.json"


_cases = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _cases, ids=[c["name"] for c in _cases])
def test_validator_fixture_cases(case: dict) -> None:
    codes = validate_tip(case["text"], case["plan"])
    if case["expect"] == "pass":
        assert codes == [], f"{case['name']}: expected pass, got {codes}"
    else:
        assert case["expect"] == "fail"
        assert case["code"] in codes, f"{case['name']}: expected {case['code']}, got {codes}"


def test_direction_guard_via_guards_kwarg() -> None:
    plan = {
        "tip_kind": "live",
        "criterion": "wrist_height",
        "direction": "too_high",
        "score": 70,
        "metric_value": None,
        "ideal": [0, 1],
    }
    text = "Gently lift the wrist until it lines up with your knuckles."
    guards = {"wrist_height": {"too_high": ["lift the wrist"]}}
    codes = validate_tip(text, plan, guards=guards)
    assert codes == ["direction_guard"]


def test_coaching_catalog_templates_pass_validation() -> None:
    config = load_coaching_config()
    blocked: list[str] = []
    for criterion, sevs in config["criteria"].items():
        for severity in ("warning", "critical"):
            for direction in ("too_low", "too_high", "generic"):
                cell = sevs[severity][direction]
                text = f"{cell['problem']} {cell['fix']}"
                plan = {
                    "tip_kind": "live",
                    "criterion": criterion,
                    "direction": direction,
                    "score": 70,
                    "metric_value": None,
                    "ideal": [0, 1],
                }
                codes = validate_tip(text, plan)
                if codes:
                    blocked.append(
                        f"{criterion}/{severity}/{direction}: codes={codes!r} text={text!r}"
                    )
                    pytest.fail(
                        "BLOCKED: coaching template failed validation — "
                        + blocked[-1]
                    )
