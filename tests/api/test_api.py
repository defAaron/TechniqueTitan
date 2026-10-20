"""API smoke tests (no MediaPipe needed for health/config/landmarks)."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app, schema_urls
from api.routes.analyze import UploadBodyLimitMiddleware
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
    assert res.json()["detail"] == "Each hand must provide landmarks with shape (21, 3)"


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


def test_schema_urls_hidden_in_production_only():
    assert schema_urls("production") == {
        "docs_url": None,
        "redoc_url": None,
        "openapi_url": None,
    }
    assert schema_urls(" prod ")["docs_url"] is None
    local = schema_urls("")
    assert local["docs_url"] == "/docs"
    assert local["redoc_url"] == "/redoc"
    assert local["openapi_url"] == "/openapi.json"
    assert schema_urls("development")["openapi_url"] == "/openapi.json"


def test_public_value_error_hides_filesystem_paths():
    from api.deps import public_value_error_detail

    assert (
        public_value_error_detail(ValueError("Could not open video file"), "fallback")
        == "Could not open video file"
    )
    hidden = public_value_error_detail(
        ValueError("failed to open /tmp/tmpabc123.mp4"),
        "Could not open video file",
    )
    assert hidden == "Could not open video file"
    assert "/tmp" not in hidden


def test_safe_video_suffix_allowlist():
    from api.service import safe_video_suffix

    assert safe_video_suffix(".mov") == ".mov"
    assert safe_video_suffix(".avi") == ".avi"
    assert safe_video_suffix(".mp4") == ".mp4"
    assert safe_video_suffix("../../etc/cron") == ".mp4"
    assert safe_video_suffix(".mp4.exe") == ".mp4"
    assert safe_video_suffix("") == ".mp4"


def test_video_tempfile_unlinked_when_open_fails(tmp_path, monkeypatch):
    import tempfile

    from api import service

    created: list[Path] = []
    real_named = tempfile.NamedTemporaryFile

    def wrapped(*args, **kwargs):
        kwargs["dir"] = str(tmp_path)
        handle = real_named(*args, **kwargs)
        created.append(Path(handle.name))
        return handle

    monkeypatch.setattr(service.tempfile, "NamedTemporaryFile", wrapped)

    class Closed:
        def __init__(self, path: str):
            self.path = path

        def isOpened(self) -> bool:
            return False

        def release(self) -> None:
            return None

    monkeypatch.setattr(service.cv2, "VideoCapture", Closed)
    with pytest.raises(ValueError, match="^Could not open video file$"):
        service.analyze_video_bytes(b"nope", {}, {}, suffix="../../etc/passwd")
    assert len(created) == 1
    assert created[0].suffix == ".mp4"
    assert ".." not in created[0].name
    assert not created[0].exists()


def test_video_tempfile_unlinked_when_capture_raises(tmp_path, monkeypatch):
    import tempfile

    from api import service

    created: list[Path] = []
    real_named = tempfile.NamedTemporaryFile

    def wrapped(*args, **kwargs):
        kwargs["dir"] = str(tmp_path)
        handle = real_named(*args, **kwargs)
        created.append(Path(handle.name))
        return handle

    monkeypatch.setattr(service.tempfile, "NamedTemporaryFile", wrapped)

    def explode(path: str):
        raise RuntimeError(f"open failed {path}")

    monkeypatch.setattr(service.cv2, "VideoCapture", explode)
    with pytest.raises(RuntimeError, match="open failed"):
        service.analyze_video_bytes(b"nope", {}, {}, suffix=".mov")
    assert len(created) == 1
    assert created[0].suffix == ".mov"
    assert not created[0].exists()


def test_upload_limit_rejects_declared_content_length_without_reading():
    called = {"receive": False, "app": False}

    async def receive():
        called["receive"] = True
        return {"type": "http.request", "body": b"", "more_body": False}

    async def downstream(scope, receive, send):
        called["app"] = True
        raise AssertionError("downstream should not run")

    messages: list[dict] = []

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/v1/analyze/video",
        "headers": [(b"content-length", b"99999999")],
    }
    asyncio.run(UploadBodyLimitMiddleware(downstream)(scope, receive, send))
    assert called == {"receive": False, "app": False}
    assert messages[0]["status"] == 413
    assert b"Video too large (max 40 MB)" in messages[1]["body"]


def test_upload_limit_aborts_chunked_body(monkeypatch):
    monkeypatch.setattr("api.routes.analyze.MAX_IMAGE_BYTES", 1024 * 1024)
    monkeypatch.setattr("api.routes.analyze.UPLOAD_FRAMING_SLACK", 0)
    chunks = [
        {"type": "http.request", "body": b"x" * (700 * 1024), "more_body": True},
        {"type": "http.request", "body": b"y" * (700 * 1024), "more_body": True},
        {"type": "http.request", "body": b"z" * (700 * 1024), "more_body": False},
    ]
    index = {"n": 0}

    async def receive():
        message = chunks[index["n"]]
        index["n"] += 1
        return message

    async def downstream(scope, receive, send):
        while True:
            message = await receive()
            if message["type"] != "http.request" or not message.get("more_body", False):
                break

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/v1/analyze/image",
        "headers": [],
    }
    messages: list[dict] = []

    async def send(message):
        messages.append(message)

    asyncio.run(UploadBodyLimitMiddleware(downstream)(scope, receive, send))
    assert messages[0]["status"] == 413
    assert b"Image too large (max 1 MB)" in messages[1]["body"]
    assert index["n"] < len(chunks)


def test_analyze_image_rejects_unsupported_type():
    res = client.post(
        "/v1/analyze/image",
        files={"file": ("hand.gif", b"GIF89a", "image/gif")},
    )
    assert res.status_code == 415


def test_small_invalid_image_is_not_size_rejected():
    res = client.post(
        "/v1/analyze/image",
        files={"file": ("hand.jpg", b"not-an-image", "image/jpeg")},
        headers={"Origin": "https://technique-titan.vercel.app"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Could not decode image bytes"


def test_analyze_image_chunked_read_enforces_file_limit(monkeypatch):
    monkeypatch.setattr("api.routes.analyze.MAX_IMAGE_BYTES", 32)
    monkeypatch.setattr("api.routes.analyze.UPLOAD_FRAMING_SLACK", 100_000)
    res = client.post(
        "/v1/analyze/image",
        files={"file": ("hand.jpg", b"x" * 64, "image/jpeg")},
        headers={"Origin": "https://technique-titan.vercel.app"},
    )
    assert res.status_code == 413
    assert res.json()["detail"] == "Image too large (max 0 MB)"
    assert (
        res.headers.get("access-control-allow-origin")
        == "https://technique-titan.vercel.app"
    )


def test_analyze_frame_and_video_reject_oversize_content_length(monkeypatch):
    monkeypatch.setattr("api.routes.analyze.MAX_IMAGE_BYTES", 32)
    monkeypatch.setattr("api.routes.analyze.MAX_VIDEO_BYTES", 32)
    monkeypatch.setattr("api.routes.analyze.UPLOAD_FRAMING_SLACK", 0)
    frame = client.post(
        "/v1/analyze/frame",
        files={"file": ("hand.jpg", b"x" * 64, "image/jpeg")},
    )
    video = client.post(
        "/v1/analyze/video",
        files={"file": ("clip.mp4", b"x" * 64, "video/mp4")},
    )
    assert frame.status_code == 413
    assert frame.json()["detail"] == "Image too large (max 0 MB)"
    assert video.status_code == 413
    assert video.json()["detail"] == "Video too large (max 0 MB)"
