"""Tests for progress session reduction."""

from __future__ import annotations

import json

from technique_titan.progress.constants import MAX_SAMPLES_JSON_BYTES, MAX_SAMPLES_PER_HAND
from technique_titan.progress.reducer import (
    ScoredTick,
    build_session_draft,
    draft_from_analyze_hands,
    enforce_samples_size,
    passes_quality_gate,
    reduce_ticks,
)


def _tick(
    t_ms: int,
    hand: str = "Right",
    confidence: float = 0.9,
    composite: float = 80.0,
    wrist_sev: str = "good",
) -> ScoredTick:
    severities = {
        "wrist_height": wrist_sev,
        "finger_curvature": "good",
        "thumb_position": "good",
        "wrist_lateral": "good",
        "hand_arch": "good",
    }
    scores = {k: 85.0 for k in severities}
    return ScoredTick(
        t_ms=t_ms,
        hand=hand,
        confidence=confidence,
        composite_score=composite,
        scores=scores,
        severities=severities,
    )


def test_passes_quality_gate_rejects_low_confidence():
    assert not passes_quality_gate(
        confidence=0.5,
        composite_score=80.0,
        severities={"wrist_height": "good"},
        min_confidence=0.6,
    )


def test_photo_single_sample_per_hand():
    hands = [
        {
            "label": "Right",
            "confidence": 0.95,
            "composite_score": 88.0,
            "scores": {"wrist_height": 90.0},
            "severities": {
                "wrist_height": "good",
                "finger_curvature": "good",
                "thumb_position": "good",
                "wrist_lateral": "good",
                "hand_arch": "good",
            },
            "coaching": {
                "tips": [],
                "primary": None,
            },
        }
    ]
    draft = draft_from_analyze_hands(hands, source="photo", min_confidence=0.6)
    assert draft.source == "photo"
    assert len(draft.samples) == 1
    assert draft.hands[0].frames_kept == 1


def test_dwell_primary_issue_picks_most_warning():
    ticks = [
        _tick(0, wrist_sev="warning"),
        _tick(500, wrist_sev="warning"),
        _tick(1000, wrist_sev="good"),
        _tick(1500, wrist_sev="good"),
    ]
    draft = build_session_draft(
        source="live",
        ticks=ticks,
        duration_s=2.0,
        frames_seen=4,
    )
    assert draft.hands[0].primary_issue == "wrist_height"
    assert draft.hands[0].frac_warning["wrist_height"] == 0.5


def test_flicker_collapse_ignores_brief_change():
    ticks = [
        _tick(0, wrist_sev="good"),
        _tick(100, wrist_sev="critical"),
        _tick(150, wrist_sev="good"),
        _tick(2000, wrist_sev="good"),
    ]
    samples = reduce_ticks(ticks, min_confidence=0.6)
    severities = [s.severities["wrist_height"] for s in samples]
    assert "critical" not in severities


def test_cap_120_samples_per_hand():
    ticks = [_tick(i * 500, hand="Right") for i in range(300)]
    samples = reduce_ticks(ticks, min_confidence=0.6)
    right = [s for s in samples if s.hand == "Right"]
    assert len(right) <= MAX_SAMPLES_PER_HAND


def test_enforce_samples_size_under_cap():
    samples = reduce_ticks([_tick(0)], min_confidence=0.6)
    enforce_samples_size(samples)


def test_draft_json_stays_under_32kb_typical():
    ticks = [_tick(i * 500) for i in range(120)]
    draft = build_session_draft(
        source="live",
        ticks=ticks,
        duration_s=60.0,
        frames_seen=120,
    )
    payload = [s.to_json() for s in draft.samples]
    size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    assert size < MAX_SAMPLES_JSON_BYTES
