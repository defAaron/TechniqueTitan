"""Oracle tests for ScoreSmoother from temporal_cases.json."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from technique_titan.coach.temporal import ScoreSmoother

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "temporal_cases.json"


def _parse_score(raw: object) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        if raw == "NaN":
            return float("nan")
        if raw == "Infinity":
            return float("inf")
        if raw == "-Infinity":
            return float("-inf")
        return float(raw)
    if isinstance(raw, (int, float)):
        return float(raw)
    raise TypeError(f"unexpected score token: {raw!r}")


def _parse_metric(raw: object) -> float | None:
    if raw is None:
        return None
    return float(raw)


def _load_cases() -> list[pytest.ParameterSet]:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    alpha = data["alpha"]
    dwell_ms = data["dwell_ms"]
    good_min = data["good_min"]
    warning_min = data["warning_min"]
    score_abs_tol = data["score_abs_tol"]
    params: list[pytest.ParameterSet] = []
    for case in data["cases"]:
        params.append(
            pytest.param(
                case["id"],
                case["hand"],
                case.get("ideals", {}),
                case["frames"],
                case["expect"],
                alpha,
                dwell_ms,
                good_min,
                warning_min,
                score_abs_tol,
                id=case["id"],
            )
        )
    return params


@pytest.mark.parametrize(
    (
        "case_id",
        "hand",
        "ideals",
        "frames",
        "expect",
        "alpha",
        "dwell_ms",
        "good_min",
        "warning_min",
        "score_abs_tol",
    ),
    _load_cases(),
)
def test_temporal_oracle(
    case_id: str,
    hand: str,
    ideals: dict,
    frames: list,
    expect: list,
    alpha: float,
    dwell_ms: int,
    good_min: float,
    warning_min: float,
    score_abs_tol: float,
) -> None:
    smoother = ScoreSmoother(
        alpha=alpha,
        dwell_ms=dwell_ms,
        good_min=good_min,
        warning_min=warning_min,
    )
    for frame, expected in zip(frames, expect, strict=True):
        t_ms = frame["t_ms"]
        scores = {
            k: _parse_score(v) for k, v in frame.get("scores", {}).items()
        }
        metrics = {
            k: _parse_metric(v) for k, v in frame.get("metrics", {}).items()
        }
        result = smoother.update(hand, t_ms, scores, metrics, ideals)
        for crit, exp in expected.items():
            got = result.criteria[crit]
            assert got.severity == exp["severity"]
            assert got.direction == exp["direction"]
            if exp["score"] is None:
                assert got.score is None
            else:
                assert got.score is not None
                assert math.isclose(got.score, exp["score"], abs_tol=score_abs_tol)
