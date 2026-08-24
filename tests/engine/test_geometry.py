import numpy as np
import pytest

from technique_titan.geometry import landmarks as L
from technique_titan.geometry import vectors as V


def test_angle_at_joint_straight_line():
    a, b, c = np.array([0, 0, 0]), np.array([1, 0, 0]), np.array([2, 0, 0])
    assert V.angle_at_joint(a, b, c) == pytest.approx(180.0)


def test_angle_at_joint_right_angle():
    a, b, c = np.array([0, 1, 0]), np.array([0, 0, 0]), np.array([1, 0, 0])
    assert V.angle_at_joint(a, b, c) == pytest.approx(90.0)


def test_angle_between_degenerate_vector_is_nan():
    assert np.isnan(V.angle_between(np.zeros(3), np.array([1, 0, 0])))


def test_normalize_landmarks_wrist_origin_and_unit_palm_span(flat_hand):
    norm = V.normalize_landmarks(flat_hand)
    assert np.allclose(norm[L.WRIST], 0.0)
    assert V.palm_span(norm) == pytest.approx(1.0)


def test_normalize_landmarks_scale_invariance(flat_hand):
    scaled_and_shifted = flat_hand * 3.7 + np.array([0.2, -0.5, 1.0])
    assert np.allclose(
        V.normalize_landmarks(flat_hand),
        V.normalize_landmarks(scaled_and_shifted),
    )


def test_finger_joint_angles_straight(flat_hand):
    angles = V.finger_joint_angles(flat_hand, L.FINGER_CHAINS["index"])
    assert angles["pip"] == pytest.approx(180.0)
    assert angles["dip"] == pytest.approx(180.0)


def test_fit_plane_recovers_z0_plane(flat_hand):
    # wrist + index MCP + pinky MCP form a proper (non-collinear) triangle
    centroid, normal = V.fit_plane(flat_hand[[L.WRIST, L.INDEX_MCP, L.PINKY_MCP]])
    assert abs(normal[2]) == pytest.approx(1.0)
    off_plane = np.array([0.5, 0.5, 0.25])
    assert abs(V.point_plane_distance(off_plane, centroid, normal)) == pytest.approx(0.25)
