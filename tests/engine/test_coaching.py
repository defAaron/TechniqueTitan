"""Unit tests for the deterministic coaching feedback engine."""

from __future__ import annotations

import pytest

from technique_titan.coaching import (
    generate_coaching,
    load_coaching_config,
    metric_direction,
    tip_for_label,
)
from technique_titan.scoring import load_config


@pytest.fixture(scope="module")
def scoring_config():
    return load_config()


@pytest.fixture(scope="module")
def coaching_config():
    return load_coaching_config()


def _ideal_metrics(scoring_config: dict) -> dict:
    """Midpoint of each criterion's ideal range (scores 100 / good)."""
    metrics = {}
    for cfg in scoring_config["criteria"].values():
        lo, hi = cfg["ideal"]
        metrics[cfg["metric"]] = (lo + hi) / 2.0
    return metrics


def test_metric_direction():
    assert metric_direction(0.0, [-0.05, 0.20]) == "in_ideal"
    assert metric_direction(-0.1, [-0.05, 0.20]) == "too_low"
    assert metric_direction(0.5, [-0.05, 0.20]) == "too_high"
    assert metric_direction(None, [-0.05, 0.20]) == "unknown"
    assert metric_direction(float("nan"), [-0.05, 0.20]) == "unknown"


def test_all_good_returns_encouragement(scoring_config, coaching_config):
    metrics = _ideal_metrics(scoring_config)
    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)

    assert report.tips == []
    assert report.primary is None
    assert report.encouragement == coaching_config["encouragement"]


def test_critical_before_warning_then_by_weight(scoring_config, coaching_config):
    # thumb_position weight 0.15, wrist_lateral weight 0.15 — critical first.
    # hand_arch weight 0.20 warning should follow all criticals.
    # wrist_height weight 0.25 critical should beat thumb critical by weight.
    metrics = _ideal_metrics(scoring_config)
    metrics["wrist_height_delta"] = 0.50  # above ideal -> too_high
    metrics["thumb_index_angle"] = 5.0  # below ideal -> too_low
    metrics["hand_arch_ratio"] = 0.05  # below ideal -> too_low

    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}
    scores["wrist_height"] = 20.0
    severities["wrist_height"] = "critical"
    scores["thumb_position"] = 30.0
    severities["thumb_position"] = "critical"
    scores["hand_arch"] = 60.0
    severities["hand_arch"] = "warning"

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)

    assert [t.criterion for t in report.tips] == [
        "wrist_height",
        "thumb_position",
        "hand_arch",
    ]
    assert report.primary is not None
    assert report.primary.criterion == "wrist_height"
    assert report.primary.priority == 0
    assert report.encouragement is None


def test_wrist_height_too_high_selects_template(scoring_config, coaching_config):
    metrics = _ideal_metrics(scoring_config)
    metrics["wrist_height_delta"] = 0.50  # above ideal_hi

    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}
    scores["wrist_height"] = 40.0
    severities["wrist_height"] = "critical"

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)

    assert len(report.tips) == 1
    tip = report.tips[0]
    assert tip.direction == "too_high"
    expected = coaching_config["criteria"]["wrist_height"]["critical"]["too_high"]
    assert tip.problem == expected["problem"]
    assert tip.fix == expected["fix"]


def test_missing_metric_uses_generic(scoring_config, coaching_config):
    metrics = _ideal_metrics(scoring_config)
    del metrics["wrist_height_delta"]

    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}
    scores["wrist_height"] = 40.0
    severities["wrist_height"] = "critical"

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)

    assert report.tips[0].direction == "generic"
    expected = coaching_config["criteria"]["wrist_height"]["critical"]["generic"]
    assert report.tips[0].problem == expected["problem"]


def test_nan_metric_uses_generic(scoring_config, coaching_config):
    metrics = _ideal_metrics(scoring_config)
    metrics["mean_finger_curvature"] = float("nan")

    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}
    scores["finger_curvature"] = 45.0
    severities["finger_curvature"] = "critical"

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)
    assert report.tips[0].direction == "generic"
    assert isinstance(report.tips[0].fix, str)


def test_stable_ordering_equal_severity_weight(scoring_config, coaching_config):
    # thumb_position and wrist_lateral both weight 0.15; config order wins.
    metrics = _ideal_metrics(scoring_config)
    metrics["thumb_index_angle"] = 5.0
    metrics["wrist_lateral_deviation_deg"] = 30.0

    scores = {k: 100.0 for k in scoring_config["criteria"]}
    severities = {k: "good" for k in scoring_config["criteria"]}
    for key in ("thumb_position", "wrist_lateral"):
        scores[key] = 40.0
        severities[key] = "critical"

    report = generate_coaching(scores, severities, metrics, scoring_config, coaching_config)
    assert [t.criterion for t in report.tips] == ["thumb_position", "wrist_lateral"]


def test_catalog_completeness(coaching_config, scoring_config):
    assert "encouragement" in coaching_config
    assert isinstance(coaching_config["encouragement"], str)
    assert coaching_config["encouragement"].strip()

    for criterion in scoring_config["criteria"]:
        assert criterion in coaching_config["criteria"]
        for severity in ("warning", "critical"):
            block = coaching_config["criteria"][criterion][severity]
            for direction in ("too_low", "too_high", "generic"):
                assert direction in block
                assert block[direction]["problem"].strip()
                assert block[direction]["fix"].strip()


def test_tip_for_label(coaching_config):
    labels = {"wrist_height": "Wrist height"}
    tip = tip_for_label(coaching_config, "Wrist height", labels)
    assert tip is not None
    assert tip.criterion == "wrist_height"
    assert tip.severity == "warning"
    assert tip.direction == "generic"
    assert tip_for_label(coaching_config, "Unknown", labels) is None
