"""API tests for POST /v1/coach/plan."""

from __future__ import annotations

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from api.deps import get_coaching_config
from api.main import app
from api.rate_limit import build_limiters_from_env, limiter_bucket

client = TestClient(app)

CRITERIA = (
    "wrist_height",
    "finger_curvature",
    "thumb_position",
    "wrist_lateral",
    "hand_arch",
)

VALID_BODY = {
    "hand": "right",
    "scores": {
        "wrist_height": 62,
        "finger_curvature": 90,
        "thumb_position": 88,
        "wrist_lateral": 91,
        "hand_arch": 70,
    },
    "severities": {
        "wrist_height": "warning",
        "finger_curvature": "good",
        "thumb_position": "good",
        "wrist_lateral": "good",
        "hand_arch": "warning",
    },
    "metrics": {
        "wrist_height_delta": 1.12,
        "mean_finger_curvature": 140,
        "thumb_index_angle": 30,
        "wrist_lateral_deviation_deg": 2,
        "hand_arch_ratio": 0.04,
    },
    "history": [],
    "tip_kind": "live",
    "locked_focus": None,
}


def test_spec_shaped_body_returns_plan_and_templates() -> None:
    coaching = get_coaching_config()
    tmpl = coaching["criteria"]["wrist_height"]["warning"]["too_high"]

    resp = client.post("/v1/coach/plan", json=VALID_BODY)
    assert resp.status_code == 200
    data = resp.json()

    plan = data["plan"]
    assert plan is not None
    assert plan["criterion"] == "wrist_height"
    assert plan["severity"] == "warning"
    assert plan["direction"] == "too_high"
    assert plan["renderer"] == "template"
    assert data["problem"] == tmpl["problem"]
    assert data["fix"] == tmpl["fix"]
    assert data["problem"]
    assert data["fix"]
    assert data["plan_key"] == "v1|right|wrist_height|warning|too_high|live||"
    assert data["lock"] is None
    assert data["encouragement"] is None


def test_history_over_max_length_422() -> None:
    today = date.today()
    entry = {
        "started_on": today.isoformat(),
        "hands": [
            {
                "hand": "right",
                "mean_composite": 90.0,
                "mean_scores": {},
                "frac_warning": {},
                "frac_critical": {},
            }
        ],
    }
    body = {**VALID_BODY, "history": [entry] * 41}
    resp = client.post("/v1/coach/plan", json=body)
    assert resp.status_code == 422


def test_extra_top_level_field_422() -> None:
    resp = client.post("/v1/coach/plan", json={"hand": "right", "extra": 1})
    assert resp.status_code == 422


@pytest.mark.parametrize(
    "scores",
    [
        {"wrist_height": 140},
        {"wrist_height": -1},
    ],
)
def test_out_of_range_scores_422(scores: dict) -> None:
    body = {
        **VALID_BODY,
        "scores": {**VALID_BODY["scores"], **scores},
    }
    resp = client.post("/v1/coach/plan", json=body)
    assert resp.status_code == 422


def test_nan_score_422() -> None:
    body = dict(VALID_BODY)
    body["scores"] = dict(VALID_BODY["scores"])
    body["scores"]["wrist_height"] = float("nan")
    payload = json.dumps(body, allow_nan=True)
    resp = client.post(
        "/v1/coach/plan",
        content=payload,
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 422


def test_sanitized_history_primary_issue_all_good_plan_null_with_lock() -> None:
    today = date.today()

    def session(day_offset: int, primary: str) -> dict:
        return {
            "started_on": (today - timedelta(days=day_offset)).isoformat(),
            "hands": [
                {
                    "hand": "right",
                    "mean_composite": 90.0,
                    "mean_scores": {c: 90.0 for c in CRITERIA},
                    "frac_warning": {c: 0.0 for c in CRITERIA},
                    "frac_critical": {c: 0.0 for c in CRITERIA},
                    "primary_issue": primary,
                }
            ],
        }

    body = {
        **VALID_BODY,
        "scores": {c: 95 for c in CRITERIA},
        "severities": {c: "good" for c in CRITERIA},
        "history": [
            session(1, "../"),
            session(2, "<script>"),
            session(3, "wrist_height"),
        ],
    }
    resp = client.post("/v1/coach/plan", json=body)
    assert resp.status_code == 200
    text = resp.text
    assert "../" not in text
    assert "<script>" not in text
    data = resp.json()
    assert data["plan"] is None
    assert data["lock"] is not None
    assert data["lock"]["criterion"] in CRITERIA


def test_all_good_empty_history_encouragement_no_lock() -> None:
    coaching = get_coaching_config()
    body = {
        **VALID_BODY,
        "scores": {c: 95 for c in CRITERIA},
        "severities": {c: "good" for c in CRITERIA},
        "history": [],
    }
    resp = client.post("/v1/coach/plan", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] is None
    assert data["problem"] is None
    assert data["fix"] is None
    assert data["encouragement"] == coaching["encouragement"]
    assert data["plan_key"] is None
    assert data["lock"] is None


def test_rate_limit_landmarks_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.main as main_mod

    monkeypatch.setattr(
        main_mod,
        "_rate_limiters",
        build_limiters_from_env(
            {"RATE_LIMIT_LANDMARKS_MAX": "2", "RATE_LIMIT_WINDOW": "60"}
        ),
    )
    for _ in range(2):
        r = client.post("/v1/coach/plan", json=VALID_BODY)
        assert r.status_code == 200
    r3 = client.post("/v1/coach/plan", json=VALID_BODY)
    assert r3.status_code == 429
    assert r3.headers.get("Retry-After") is not None


def test_limiter_bucket_paths() -> None:
    assert limiter_bucket("/v1/coach/plan") == "landmarks"
    assert limiter_bucket("/v1/score/landmarks") == "landmarks"
    assert limiter_bucket("/v1/analyze/frame") == "frame"
    assert limiter_bucket("/v1/progress/reduce") == "heavy"
