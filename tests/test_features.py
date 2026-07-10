import pytest

from technique_titan.features import extract_all_features


def test_flat_hand_features(flat_hand):
    out = extract_all_features(flat_hand, "Right")
    metrics = out["criterion_metrics"]

    # Fingers are dead straight -> every joint angle 180
    assert metrics["mean_finger_curvature"] == pytest.approx(180.0)

    # Knuckle line 0.3 above the wrist, palm span 0.3 -> delta exactly 1.0
    assert metrics["wrist_height_delta"] == pytest.approx(1.0)

    # Middle MCP directly above wrist, horizontal knuckle line -> no deviation
    assert metrics["wrist_lateral_deviation_deg"] == pytest.approx(0.0, abs=0.01)

    # Everything lies on the z=0 plane -> no arch, no thumb lateral offset
    assert metrics["hand_arch_ratio"] == pytest.approx(0.0, abs=1e-6)
    assert metrics["thumb_lateral_offset"] == pytest.approx(0.0, abs=1e-6)


def test_curved_index_lowers_mean_curvature(curved_hand, flat_hand):
    flat = extract_all_features(flat_hand, "Right")["criterion_metrics"]
    curved = extract_all_features(curved_hand, "Right")["criterion_metrics"]
    assert curved["mean_finger_curvature"] < flat["mean_finger_curvature"]


def test_curved_index_pip_angle_is_90(curved_hand):
    out = extract_all_features(curved_hand, "Right")
    assert out["angles_deg"]["index_pip"] == pytest.approx(90.0)


def test_left_hand_flips_lateral_deviation_sign(flat_hand):
    # Introduce a small ulnar bend by shifting the middle MCP sideways
    bent = flat_hand.copy()
    bent[9][0] += 0.05
    right = extract_all_features(bent, "Right")["criterion_metrics"]
    left = extract_all_features(bent, "Left")["criterion_metrics"]
    assert right["wrist_lateral_deviation_deg"] == pytest.approx(
        -left["wrist_lateral_deviation_deg"]
    )
    assert right["wrist_lateral_deviation_deg"] != 0
