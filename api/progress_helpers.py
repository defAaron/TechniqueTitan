"""Serialize progress drafts for API responses."""

from __future__ import annotations

from technique_titan.progress.reducer import SessionDraft

from .schemas import HandSummaryOut, SessionDraftOut, SessionSampleOut


def scoring_version(scoring_config: dict) -> str:
    return str(scoring_config.get("version", "unknown"))


def min_confidence(scoring_config: dict) -> float:
    return float(scoring_config.get("outliers", {}).get("min_confidence", 0.6))


def draft_to_out(draft: SessionDraft, scoring_config: dict) -> SessionDraftOut:
    return SessionDraftOut(
        source=draft.source,
        duration_s=draft.duration_s,
        frames_seen=draft.frames_seen,
        frames_kept=draft.frames_kept,
        scoring_version=scoring_version(scoring_config),
        hands=[
            HandSummaryOut(
                hand=h.hand,
                frames_kept=h.frames_kept,
                mean_composite=h.mean_composite,
                p10_composite=h.p10_composite,
                mean_scores=h.mean_scores,
                frac_warning=h.frac_warning,
                frac_critical=h.frac_critical,
                primary_issue=h.primary_issue,
                tip_problem=h.tip_problem,
                tip_fix=h.tip_fix,
            )
            for h in draft.hands
        ],
        samples=[
            SessionSampleOut(
                t_ms=s.t_ms,
                hand=s.hand,
                confidence=s.confidence,
                composite=s.composite,
                scores=s.scores,
                severities=s.severities,
            )
            for s in draft.samples
        ],
    )
