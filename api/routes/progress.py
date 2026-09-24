"""Progress session reduction routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from technique_titan.progress.reducer import ScoredTick, build_session_draft, enforce_samples_size, tips_from_hand

from ..deps import get_scoring_config
from ..progress_helpers import draft_to_out, min_confidence
from ..schemas import ReduceProgressRequest, SessionDraftOut

router = APIRouter(prefix="/v1", tags=["progress"])


@router.post("/progress/reduce", response_model=SessionDraftOut)
def reduce_progress(body: ReduceProgressRequest) -> SessionDraftOut:
    if not body.ticks:
        raise HTTPException(status_code=400, detail="Provide at least one scored tick")

    scoring_config = get_scoring_config()
    conf_min = min_confidence(scoring_config)
    ticks: list[ScoredTick] = []
    tip_by_hand: dict[str, dict] = {}

    for tick in body.ticks:
        hand_dict = {
            "label": tick.hand,
            "confidence": tick.confidence,
            "composite_score": tick.composite_score,
            "scores": tick.scores,
            "severities": tick.severities,
            "coaching": tick.coaching.model_dump() if tick.coaching else {},
        }
        tips = tips_from_hand(hand_dict)
        tip_by_hand.setdefault(tick.hand, {}).update(tips)
        ticks.append(
            ScoredTick(
                t_ms=tick.t_ms,
                hand=tick.hand,
                confidence=tick.confidence,
                composite_score=tick.composite_score,
                scores=tick.scores,
                severities=tick.severities,
            )
        )

    try:
        draft = build_session_draft(
            source=body.source,
            ticks=ticks,
            duration_s=body.duration_s,
            frames_seen=body.frames_seen or len(body.ticks),
            min_confidence=conf_min,
            tip_by_hand=tip_by_hand,
        )
        for summary in draft.hands:
            if summary.primary_issue:
                tips = tip_by_hand.get(summary.hand, {})
                prob, fix = tips.get(summary.primary_issue, (None, None))
                summary.tip_problem = prob
                summary.tip_fix = fix
        enforce_samples_size(draft.samples)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not draft.hands:
        raise HTTPException(
            status_code=400,
            detail="No hands passed quality checks. Try better lighting and hold the hand in frame.",
        )

    return draft_to_out(draft, scoring_config)
