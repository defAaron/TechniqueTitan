import math

import pytest

from technique_titan.scoring import load_config, score_all, score_metric, severity


def test_score_inside_ideal_is_100():
    assert score_metric(0.1, ideal=[0.0, 0.2], limit=[-0.4, 0.6]) == 100.0


def test_score_at_limit_edge_is_0():
    assert score_metric(0.6, ideal=[0.0, 0.2], limit=[-0.4, 0.6]) == 0.0
    assert score_metric(-0.4, ideal=[0.0, 0.2], limit=[-0.4, 0.6]) == 0.0


def test_score_linear_between_ideal_and_limit():
    # halfway between ideal_hi (0.2) and limit_hi (0.6) -> 50
    assert score_metric(0.4, ideal=[0.0, 0.2], limit=[-0.4, 0.6]) == pytest.approx(50.0)


def test_score_nan_metric_is_nan():
    assert math.isnan(score_metric(float("nan"), ideal=[0, 1], limit=[-1, 2]))


def test_severity_bands():
    bands = {"good_min": 80, "warning_min": 50}
    assert severity(95.0, bands) == "good"
    assert severity(65.0, bands) == "warning"
    assert severity(10.0, bands) == "critical"
    assert severity(float("nan"), bands) == "unknown"


def test_score_all_with_default_config():
    config = load_config()
    metrics = {
        "wrist_height_delta": 0.1,
        "mean_finger_curvature": 140.0,
        "thumb_index_angle": 35.0,
        "wrist_lateral_deviation_deg": 2.0,
        "hand_arch_ratio": 0.25,
    }
    result = score_all(metrics, config)
    assert set(result["scores"]) == set(config["criteria"])
    assert all(v == 100.0 for v in result["scores"].values())
    assert result["composite_score"] == 100.0
    assert all(s == "good" for s in result["severities"].values())


def test_score_all_missing_metric_is_unknown():
    config = load_config()
    result = score_all({}, config)
    assert all(v is None for v in result["scores"].values())
    assert all(s == "unknown" for s in result["severities"].values())
    assert result["composite_score"] is None
