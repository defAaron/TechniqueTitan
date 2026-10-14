"""SCORER flag: YAML default, ML with per-criterion YAML fallback, model path lock."""

from __future__ import annotations

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

joblib = pytest.importorskip("joblib")
pytest.importorskip("sklearn")
from sklearn.dummy import DummyClassifier  # noqa: E402

from api import scorer  # noqa: E402
from api.main import app  # noqa: E402
from technique_titan.analysis import score_detected_hands  # noqa: E402
from technique_titan.detection import HandDetection  # noqa: E402
from technique_titan.ml.features import FEATURE_NAMES  # noqa: E402
from technique_titan.scoring import load_config  # noqa: E402
from tests.conftest import build_flat_hand  # noqa: E402

CRITERIA = ("wrist_height", "finger_curvature", "thumb_position", "wrist_lateral", "hand_arch")


def _constant(label: str) -> DummyClassifier:
    x = np.zeros((2, len(FEATURE_NAMES)))
    return DummyClassifier(strategy="constant", constant=label).fit(x, [label, label])


def _write_models(directory, overrides: dict | None = None) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "manifest.json").write_text(
        json.dumps({"algorithm": "test", "feature_names": list(FEATURE_NAMES)})
    )
    overrides = overrides or {}
    for criterion in CRITERIA:
        model = overrides.get(criterion, _constant("critical"))
        joblib.dump(model, directory / f"{criterion}.joblib")


@pytest.fixture
def models_dir(tmp_path, monkeypatch):
    directory = tmp_path / "models"
    monkeypatch.setattr(scorer, "MODELS_DIR", directory)
    scorer.reset_model_cache()
    yield directory
    scorer.reset_model_cache()


def _results():
    hand = HandDetection(
        landmarks=build_flat_hand(),
        world_landmarks=None,
        handedness="Right",
        confidence=0.95,
    )
    return score_detected_hands([hand], load_config())


def test_yaml_default_never_loads_joblib(models_dir, monkeypatch):
    _write_models(models_dir)
    monkeypatch.delenv("SCORER", raising=False)

    def boom(*_a, **_k):
        raise AssertionError("joblib must not load when SCORER=yaml")

    monkeypatch.setattr(joblib, "load", boom)
    results = _results()
    assert scorer.apply_scorer(results) is results


@pytest.mark.parametrize("value", ["yaml", "YAML", "ml", "../config/models", ""])
def test_unrecognized_scorer_values_mean_yaml(value, monkeypatch):
    monkeypatch.setenv("SCORER", value)
    assert scorer.scorer_mode() == "yaml"


def test_ml_with_fallback_uses_fake_pipeline(models_dir, monkeypatch):
    _write_models(models_dir)
    monkeypatch.setenv("SCORER", "ml_with_fallback")
    out = scorer.apply_scorer(_results())
    assert out[0].severities == {c: "critical" for c in CRITERIA}
    assert out[0].composite_severity == "critical"


def test_throwing_pipeline_falls_back_per_criterion(models_dir, monkeypatch):
    unfitted = DummyClassifier(strategy="constant", constant="critical")
    _write_models(
        models_dir,
        {"thumb_position": unfitted, "hand_arch": _constant("unknown")},
    )
    monkeypatch.setenv("SCORER", "ml_with_fallback")
    yaml_sev = _results()[0].severities
    out = scorer.apply_scorer(_results())[0].severities
    assert out["thumb_position"] == yaml_sev["thumb_position"]
    assert out["hand_arch"] == yaml_sev["hand_arch"]
    for criterion in ("wrist_height", "finger_curvature", "wrist_lateral"):
        assert out[criterion] == "critical"


def test_missing_models_keep_yaml(models_dir, monkeypatch):
    monkeypatch.setenv("SCORER", "ml_with_fallback")
    results = _results()
    assert scorer.apply_scorer(results) is results


def test_models_dir_must_be_config_models(models_dir, tmp_path):
    assert scorer.resolve_models_dir() == models_dir.resolve()
    assert scorer.resolve_models_dir(models_dir / ".." / "models") == models_dir.resolve()
    for bad in (tmp_path, tmp_path / "other", models_dir / "..", "/etc"):
        with pytest.raises(ValueError):
            scorer.resolve_models_dir(bad)


def test_default_models_dir_is_repo_config_models():
    assert scorer.MODELS_DIR == scorer.REPO_ROOT / "config" / "models"


def _post_landmarks(client: TestClient, extra: dict | None = None):
    body = {
        "hands": [
            {"landmarks": build_flat_hand().tolist(), "handedness": "Right", "confidence": 0.95}
        ]
    }
    body.update(extra or {})
    return client.post("/v1/score/landmarks", json=body)


def test_landmarks_route_uses_flag(models_dir, monkeypatch):
    _write_models(models_dir)
    client = TestClient(app)

    monkeypatch.delenv("SCORER", raising=False)
    yaml_body = _post_landmarks(client).json()

    monkeypatch.setenv("SCORER", "ml_with_fallback")
    ml_body = _post_landmarks(client).json()

    assert ml_body["hands"][0]["severities"] == {c: "critical" for c in CRITERIA}
    assert ml_body["hands"][0]["scores"] == yaml_body["hands"][0]["scores"]


def test_request_body_cannot_pick_models_dir(models_dir, monkeypatch, tmp_path):
    other = tmp_path / "attacker"
    _write_models(other)
    monkeypatch.setenv("SCORER", "ml_with_fallback")
    res = _post_landmarks(TestClient(app), {"models_dir": str(other), "scorer": "ml"})
    assert res.status_code in (200, 422)
    if res.status_code == 200:
        yaml_sev = _results()[0].severities
        assert res.json()["hands"][0]["severities"] == yaml_sev
