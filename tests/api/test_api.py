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


def test_progress_reduce_empty():
    res = client.post("/v1/progress/reduce", json={"source": "live", "ticks": []})
    assert res.status_code == 400


def test_progress_reduce_one_tick():
    landmarks = build_flat_hand().tolist()
    score_res = client.post(
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
    hand = score_res.json()["hands"][0]
    res = client.post(
        "/v1/progress/reduce",
        json={
            "source": "live",
            "duration_s": 1.0,
            "frames_seen": 1,
            "ticks": [
                {
                    "t_ms": 0,
                    "hand": hand["label"],
                    "confidence": hand["confidence"],
                    "composite_score": hand["composite_score"],
                    "scores": hand["scores"],
                    "severities": hand["severities"],
                    "coaching": hand["coaching"],
                }
            ],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "live"
    assert len(body["hands"]) == 1
    assert body["scoring_version"]


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
