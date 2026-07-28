"""API smoke tests (no MediaPipe needed for health/config/landmarks)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from tests.conftest import build_flat_hand

client = TestClient(app)


def test_health():
    res = client.get("/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_public_config():
    res = client.get("/v1/config/public")
    assert res.status_code == 200
    body = res.json()
    assert "wrist_height" in body["criterion_labels"]
    assert "photo" in body["modes"]


def test_score_landmarks_validation():
    res = client.post("/v1/score/landmarks", json={"hands": []})
    assert res.status_code == 400


def test_score_landmarks_shape_error():
    res = client.post(
        "/v1/score/landmarks",
        json={
            "hands": [
                {
                    "landmarks": [[0, 0, 0]] * 10,
                    "handedness": "Left",
                    "confidence": 0.9,
                }
            ]
        },
    )
    assert res.status_code == 400


def test_score_landmarks_flat_hand():
    landmarks = build_flat_hand().tolist()
    res = client.post(
        "/v1/score/landmarks",
        json={
            "hands": [
                {
                    "landmarks": landmarks,
                    "handedness": "Right",
                    "confidence": 0.95,
                }
            ]
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["hands"]) == 1
    hand = body["hands"][0]
    assert hand["label"] in ("Left", "Right")
    assert "wrist_height" in hand["scores"]
    assert hand["composite_score"] is not None
    assert "coaching" in hand
