"""Reduce scored frames/ticks into a compact session draft for progress storage."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from statistics import mean
from typing import Any, Iterable, Mapping, Sequence

from .constants import (
    CRITERIA,
    FLICKER_MS,
    HEARTBEAT_MS,
    MAX_SAMPLES_JSON_BYTES,
    MAX_SAMPLES_PER_HAND,
)

Severity = str


@dataclass
class ScoredTick:
    """One scored observation for a single hand."""

    t_ms: int
    hand: str
    confidence: float
    composite_score: float | None
    scores: Mapping[str, float | None]
    severities: Mapping[str, Severity]
    tip_problem: str | None = None
    tip_fix: str | None = None


@dataclass
class SessionSample:
    t_ms: int
    hand: str
    confidence: float
    composite: float | None
    scores: dict[str, float | None]
    severities: dict[str, Severity]

    def to_json(self) -> dict[str, Any]:
        return {
            "t_ms": self.t_ms,
            "hand": self.hand,
            "confidence": round(self.confidence, 4),
            "composite": self.composite,
            "scores": self.scores,
            "severities": self.severities,
        }


@dataclass
class HandSummary:
    hand: str
    frames_kept: int
    mean_composite: float | None
    p10_composite: float | None
    mean_scores: dict[str, float | None]
    frac_warning: dict[str, float]
    frac_critical: dict[str, float]
    primary_issue: str | None
    tip_problem: str | None
    tip_fix: str | None

    def to_json(self) -> dict[str, Any]:
        return {
            "hand": self.hand,
            "frames_kept": self.frames_kept,
            "mean_composite": self.mean_composite,
            "p10_composite": self.p10_composite,
            "mean_scores": self.mean_scores,
            "frac_warning": self.frac_warning,
            "frac_critical": self.frac_critical,
            "primary_issue": self.primary_issue,
            "tip_problem": self.tip_problem,
            "tip_fix": self.tip_fix,
        }


@dataclass
class SessionDraft:
    source: str
    duration_s: float
    frames_seen: int
    frames_kept: int
    hands: list[HandSummary] = field(default_factory=list)
    samples: list[SessionSample] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "duration_s": round(self.duration_s, 3),
            "frames_seen": self.frames_seen,
            "frames_kept": self.frames_kept,
            "hands": [h.to_json() for h in self.hands],
            "samples": [s.to_json() for s in self.samples],
        }


def passes_quality_gate(
    *,
    confidence: float,
    composite_score: float | None,
    severities: Mapping[str, Severity],
    min_confidence: float,
) -> bool:
    if confidence < min_confidence:
        return False
    if composite_score is None or (
        isinstance(composite_score, float) and math.isnan(composite_score)
    ):
        return False
    if any(severities.get(c) == "unknown" for c in CRITERIA):
        return False
    return True


def _severity_signature(severities: Mapping[str, Severity]) -> tuple[Severity, ...]:
    return tuple(severities.get(c, "unknown") for c in CRITERIA)


def _tick_to_sample(tick: ScoredTick) -> SessionSample:
    return SessionSample(
        t_ms=tick.t_ms,
        hand=tick.hand,
        confidence=tick.confidence,
        composite=tick.composite_score,
        scores={k: tick.scores.get(k) for k in CRITERIA},
        severities={k: tick.severities.get(k, "unknown") for k in CRITERIA},
    )


def reduce_ticks(
    ticks: Sequence[ScoredTick],
    *,
    min_confidence: float = 0.6,
) -> list[SessionSample]:
    """Filter, debounce, heartbeat-sample, and cap per hand."""
    by_hand: dict[str, list[ScoredTick]] = {}
    for tick in sorted(ticks, key=lambda t: (t.hand, t.t_ms)):
        if not passes_quality_gate(
            confidence=tick.confidence,
            composite_score=tick.composite_score,
            severities=tick.severities,
            min_confidence=min_confidence,
        ):
            continue
        by_hand.setdefault(tick.hand, []).append(tick)

    all_samples: list[SessionSample] = []
    for hand, hand_ticks in by_hand.items():
        reduced = _reduce_hand_ticks(hand_ticks)
        capped = _cap_samples(reduced, MAX_SAMPLES_PER_HAND)
        all_samples.extend(capped)
    all_samples.sort(key=lambda s: (s.hand, s.t_ms))
    return all_samples


def _reduce_hand_ticks(ticks: Sequence[ScoredTick]) -> list[SessionSample]:
    if not ticks:
        return []

    kept: list[SessionSample] = []
    last_kept_t = ticks[0].t_ms
    last_sig = _severity_signature(ticks[0].severities)
    kept.append(_tick_to_sample(ticks[0]))

    pending_sig: tuple[Severity, ...] | None = None
    pending_since: int | None = None

    for tick in ticks[1:]:
        sig = _severity_signature(tick.severities)
        if sig == last_sig:
            pending_sig = None
            pending_since = None
        else:
            if pending_sig != sig:
                pending_sig = sig
                pending_since = tick.t_ms
            elif pending_since is not None and tick.t_ms - pending_since >= FLICKER_MS:
                if tick.t_ms - last_kept_t >= HEARTBEAT_MS or sig != last_sig:
                    kept.append(_tick_to_sample(tick))
                    last_kept_t = tick.t_ms
                    last_sig = sig
                pending_sig = None
                pending_since = None
                continue

        if tick.t_ms - last_kept_t >= HEARTBEAT_MS:
            kept.append(_tick_to_sample(tick))
            last_kept_t = tick.t_ms
            last_sig = sig

    return kept


def _cap_samples(samples: Sequence[SessionSample], max_n: int) -> list[SessionSample]:
    if len(samples) <= max_n:
        return list(samples)
    step = len(samples) / max_n
    indices = [int(i * step) for i in range(max_n)]
    return [samples[i] for i in indices]


def summarize_hand(
    samples: Sequence[SessionSample],
    *,
    hand: str,
    tip_lookup: Mapping[str, tuple[str | None, str | None]] | None = None,
) -> HandSummary | None:
    hand_samples = [s for s in samples if s.hand == hand]
    if not hand_samples:
        return None

    composites = [s.composite for s in hand_samples if s.composite is not None]
    mean_composite = round(mean(composites), 1) if composites else None
    p10 = _percentile(composites, 10) if composites else None

    mean_scores: dict[str, float | None] = {}
    for crit in CRITERIA:
        vals = [s.scores.get(crit) for s in hand_samples if s.scores.get(crit) is not None]
        mean_scores[crit] = round(mean(vals), 1) if vals else None

    frac_warning: dict[str, float] = {}
    frac_critical: dict[str, float] = {}
    n = len(hand_samples)
    for crit in CRITERIA:
        w = sum(1 for s in hand_samples if s.severities.get(crit) == "warning")
        c = sum(1 for s in hand_samples if s.severities.get(crit) == "critical")
        frac_warning[crit] = round(w / n, 4)
        frac_critical[crit] = round(c / n, 4)

    primary_issue = _primary_issue(frac_warning, frac_critical)
    tip_problem, tip_fix = (None, None)
    if tip_lookup and primary_issue and primary_issue in tip_lookup:
        tip_problem, tip_fix = tip_lookup[primary_issue]
    elif primary_issue:
        for s in reversed(hand_samples):
            if s.severities.get(primary_issue) in ("warning", "critical"):
                break
        # tips filled by caller via tip_lookup when available

    return HandSummary(
        hand=hand,
        frames_kept=n,
        mean_composite=mean_composite,
        p10_composite=p10,
        mean_scores=mean_scores,
        frac_warning=frac_warning,
        frac_critical=frac_critical,
        primary_issue=primary_issue,
        tip_problem=tip_problem,
        tip_fix=tip_fix,
    )


def _primary_issue(
    frac_warning: Mapping[str, float], frac_critical: Mapping[str, float]
) -> str | None:
    best_crit: str | None = None
    best_score = 0.0
    for crit in CRITERIA:
        score = frac_warning.get(crit, 0.0) + frac_critical.get(crit, 0.0)
        if score > best_score:
            best_score = score
            best_crit = crit
    if best_score <= 0:
        return None
    return best_crit


def _percentile(values: Sequence[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, int(math.ceil(pct / 100.0 * len(ordered))) - 1))
    return round(ordered[k], 1)


def build_session_draft(
    *,
    source: str,
    ticks: Sequence[ScoredTick],
    duration_s: float,
    frames_seen: int,
    min_confidence: float = 0.6,
    tip_by_hand: Mapping[str, Mapping[str, tuple[str | None, str | None]]] | None = None,
) -> SessionDraft:
    samples = reduce_ticks(ticks, min_confidence=min_confidence)
    hands_labels = sorted({s.hand for s in samples})
    summaries: list[HandSummary] = []
    for label in hands_labels:
        tips = tip_by_hand.get(label) if tip_by_hand else None
        summary = summarize_hand(samples, hand=label, tip_lookup=tips)
        if summary:
            summaries.append(summary)

    return SessionDraft(
        source=source,
        duration_s=duration_s,
        frames_seen=frames_seen,
        frames_kept=len(samples),
        hands=summaries,
        samples=samples,
    )


def enforce_samples_size(samples: Sequence[SessionSample]) -> None:
    """Raise ValueError if serialized samples exceed the free-tier jsonb cap."""
    payload = [s.to_json() for s in samples]
    size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    if size > MAX_SAMPLES_JSON_BYTES:
        raise ValueError(
            f"Session samples exceed {MAX_SAMPLES_JSON_BYTES} bytes ({size} bytes). "
            "Shorten the session or reduce sample rate."
        )


def hand_result_to_tick(
    hand: Mapping[str, Any],
    *,
    t_ms: int,
    tip_for_criterion: Mapping[str, tuple[str | None, str | None]] | None = None,
) -> ScoredTick:
    """Build a tick from API HandResultOut-shaped dict."""
    primary = hand.get("coaching", {}).get("primary") or {}
    crit = primary.get("criterion")
    tips = tip_for_criterion or {}
    tip_problem, tip_fix = tips.get(crit, (primary.get("problem"), primary.get("fix")))
    return ScoredTick(
        t_ms=t_ms,
        hand=str(hand["label"]),
        confidence=float(hand["confidence"]),
        composite_score=hand.get("composite_score"),
        scores=dict(hand.get("scores") or {}),
        severities=dict(hand.get("severities") or {}),
        tip_problem=tip_problem,
        tip_fix=tip_fix,
    )


def tips_from_hand(hand: Mapping[str, Any]) -> dict[str, tuple[str | None, str | None]]:
    out: dict[str, tuple[str | None, str | None]] = {}
    for tip in hand.get("coaching", {}).get("tips") or []:
        crit = tip.get("criterion")
        if crit:
            out[crit] = (tip.get("problem"), tip.get("fix"))
    primary = hand.get("coaching", {}).get("primary")
    if primary and primary.get("criterion"):
        out[primary["criterion"]] = (primary.get("problem"), primary.get("fix"))
    return out


def draft_from_analyze_hands(
    hands: Sequence[Mapping[str, Any]],
    *,
    source: str,
    min_confidence: float,
    duration_s: float = 0.0,
    frames_seen: int = 1,
    t_ms_for_hand: Iterable[int] | None = None,
) -> SessionDraft:
    ticks: list[ScoredTick] = []
    for idx, hand in enumerate(hands):
        t_ms = 0 if t_ms_for_hand is None else list(t_ms_for_hand)[idx]
        tips = tips_from_hand(hand)
        tick = hand_result_to_tick(hand, t_ms=t_ms, tip_for_criterion=tips)
        ticks.append(tick)

    tip_by_hand = {str(h["label"]): tips_from_hand(h) for h in hands}
    draft = build_session_draft(
        source=source,
        ticks=ticks,
        duration_s=duration_s,
        frames_seen=frames_seen,
        min_confidence=min_confidence,
        tip_by_hand=tip_by_hand,
    )
    for summary in draft.hands:
        if summary.primary_issue and summary.tip_problem is None:
            tips = tip_by_hand.get(summary.hand, {})
            prob, fix = tips.get(summary.primary_issue, (None, None))
            summary.tip_problem = prob
            summary.tip_fix = fix
    enforce_samples_size(draft.samples)
    return draft


def draft_from_video_frames(
    frames: Sequence[Mapping[str, Any]],
    *,
    fps: float,
    min_confidence: float,
) -> SessionDraft:
    ticks: list[ScoredTick] = []
    tip_by_hand: dict[str, dict[str, tuple[str | None, str | None]]] = {}
    for frame in frames:
        frame_index = int(frame.get("frame_index", 0))
        t_ms = int(frame_index / max(fps, 1.0) * 1000)
        for hand in frame.get("hands") or []:
            tips = tips_from_hand(hand)
            tip_by_hand.setdefault(str(hand["label"]), {}).update(tips)
            ticks.append(hand_result_to_tick(hand, t_ms=t_ms, tip_for_criterion=tips))

    duration_s = 0.0
    if frames:
        last_idx = max(int(f.get("frame_index", 0)) for f in frames)
        duration_s = last_idx / max(fps, 1.0)

    draft = build_session_draft(
        source="video",
        ticks=ticks,
        duration_s=duration_s,
        frames_seen=len(frames),
        min_confidence=min_confidence,
        tip_by_hand=tip_by_hand,
    )
    for summary in draft.hands:
        if summary.primary_issue:
            tips = tip_by_hand.get(summary.hand, {})
            prob, fix = tips.get(summary.primary_issue, (None, None))
            summary.tip_problem = prob
            summary.tip_fix = fix
    enforce_samples_size(draft.samples)
    return draft
