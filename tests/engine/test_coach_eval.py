"""LoRA adapter eval gate with a fake completer (no MLX)."""

from __future__ import annotations

import json
from collections import Counter

import pytest

from technique_titan.coach import eval_adapter as ea
from technique_titan.coach.draft_paraphrases import plan_from_row, training_row

GOOD = json.dumps({"problem": "Your wrist is a bit off.", "fix": "Keep the wrist level."})
BAD = json.dumps({"problem": "See a doctor about the wrist.", "fix": "Rest it."})


def _rows(n: int, *, criterion: str = "wrist_height", tip_kind: str = "live") -> list[dict]:
    plan = {
        "criterion": criterion,
        "severity": "warning",
        "direction": "too_high",
        "score": 62,
        "tip_kind": tip_kind,
    }
    return [training_row(plan, "Your wrist dips.", "Lift the wrist.") for _ in range(n)]


def _completer(good_count: int):
    calls = {"n": 0}

    def complete(messages: list[dict]) -> str:
        assert [m["role"] for m in messages] == ["system", "user"]
        calls["n"] += 1
        return GOOD if calls["n"] <= good_count else BAD

    return complete


def _result(passed: int, n: int = 100) -> ea.EvalResult:
    return ea.EvalResult(n=n, passed=passed, exact=0)


def test_gate_fails_at_94_percent():
    assert not ea.gate_passes(_result(94), _result(95))
    assert not ea.gate_passes(_result(95), _result(94))


def test_gate_passes_at_95_percent_on_both():
    assert ea.gate_passes(_result(95), _result(95))
    assert ea.gate_passes(_result(19, n=20), _result(24, n=25))
    assert not ea.gate_passes(_result(19, n=20), _result(23, n=25))


def test_gate_fails_on_empty_sets():
    assert not ea.gate_passes(_result(0, n=0), _result(25, n=25))


def test_evaluate_counts_validator_passes_with_fake_completer():
    rows = [
        training_row(
            {"criterion": "wrist_height", "severity": "warning", "direction": "too_high",
             "score": 62, "tip_kind": "live"},
            "Your wrist dips.",
            "Lift the wrist.",
        )
        for _ in range(100)
    ]
    result = ea.evaluate(rows, _completer(good_count=94))
    assert (result.n, result.passed) == (100, 94)
    assert result.pass_rate == pytest.approx(0.94)


def test_evaluate_counts_exact_template_matches():
    row = training_row(
        {"criterion": "wrist_height", "severity": "warning", "direction": "too_high",
         "score": 62, "tip_kind": "live"},
        "Your wrist is a bit off.",
        "Keep the wrist level.",
    )
    result = ea.evaluate([row, row], lambda _m: GOOD)
    assert result.exact == 2


def test_evaluate_treats_completer_errors_as_failures():
    def boom(_messages):
        raise RuntimeError("metal out of memory")

    result = ea.evaluate(_rows(3), boom)
    assert (result.n, result.passed) == (3, 0)


def test_run_eval_exit_code_follows_gate(tmp_path, capsys):
    dev = tmp_path / "valid.jsonl"
    probe = tmp_path / "probe.jsonl"
    ea.write_jsonl(_rows(20), dev)
    ea.write_jsonl(_rows(25), probe)

    assert ea.run_eval(dev, probe, lambda _m: GOOD) == 0
    assert "gate: PASS" in capsys.readouterr().out
    assert ea.run_eval(dev, probe, _completer(good_count=20 + 23)) == 1
    assert "gate: FAIL" in capsys.readouterr().out


def test_split_by_cell_puts_every_multi_row_cell_in_dev():
    rows = (
        _rows(10, criterion="wrist_height")
        + _rows(10, criterion="finger_curvature")
        + _rows(1, criterion="thumb_position")
    )
    dev = ea.split_by_cell(rows)
    assert dev == ea.split_by_cell(rows)
    cells = Counter(plan_from_row(rows[i])["criterion"] for i in dev)
    assert cells == {"wrist_height": 1, "finger_curvature": 1}


def test_cli_refuses_other_models(capsys):
    code = ea.main(["eval", "--model", "Qwen/Qwen2.5-7B-Instruct"], completer=lambda _m: GOOD)
    assert code == 2
