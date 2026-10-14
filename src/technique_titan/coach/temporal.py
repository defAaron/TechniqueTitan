"""Temporal score smoothing with EMA and dwell-gated severity/direction."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class SmoothedCriterion:
    score: float | None
    severity: str
    direction: str


@dataclass(frozen=True)
class SmoothedHand:
    hand: str
    criteria: dict[str, SmoothedCriterion]


def _finite_score(value: float | None) -> bool:
    if value is None:
        return False
    return math.isfinite(value)


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _band_from_ema(ema: float, *, good_min: float, warning_min: float) -> str:
    if ema >= good_min:
        return "good"
    if ema >= warning_min:
        return "warning"
    return "critical"


@dataclass
class _CriterionState:
    ema: float | None = None
    published_severity: str | None = None
    pending_severity: str | None = None
    pending_severity_since: int | None = None
    published_direction: str | None = None
    pending_direction: str | None = None
    pending_direction_since: int | None = None


class ScoreSmoother:
    def __init__(
        self,
        *,
        alpha: float = 0.35,
        dwell_ms: int = 1200,
        good_min: float = 80,
        warning_min: float = 50,
    ) -> None:
        self._alpha = alpha
        self._dwell_ms = dwell_ms
        self._good_min = good_min
        self._warning_min = warning_min
        self._state: dict[tuple[str, str], _CriterionState] = {}

    def _state_for(self, hand: str, criterion: str) -> _CriterionState:
        key = (hand, criterion)
        if key not in self._state:
            self._state[key] = _CriterionState()
        return self._state[key]

    def update(
        self,
        hand: str,
        t_ms: int,
        scores: dict[str, float | None],
        metrics: dict[str, float | None],
        ideals: dict[str, list[float]],
    ) -> SmoothedHand:
        criteria: dict[str, SmoothedCriterion] = {}

        for criterion, raw_score in scores.items():
            st = self._state_for(hand, criterion)

            if _finite_score(raw_score):
                clamped = _clamp_score(float(raw_score))
                first_score = st.ema is None
                if first_score:
                    st.ema = clamped
                else:
                    st.ema = self._alpha * clamped + (1.0 - self._alpha) * st.ema

                band = _band_from_ema(
                    st.ema, good_min=self._good_min, warning_min=self._warning_min
                )
                if first_score:
                    st.published_severity = band
                elif band == st.published_severity:
                    st.pending_severity = None
                    st.pending_severity_since = None
                else:
                    if st.pending_severity != band:
                        st.pending_severity = band
                        st.pending_severity_since = t_ms
                    elif (
                        st.pending_severity_since is not None
                        and t_ms - st.pending_severity_since >= self._dwell_ms
                    ):
                        st.published_severity = band
                        st.pending_severity = None
                        st.pending_severity_since = None

            direction = self._update_direction(
                st, t_ms, metrics.get(criterion), ideals.get(criterion)
            )

            if st.ema is not None and st.published_severity is not None:
                criteria[criterion] = SmoothedCriterion(
                    score=st.ema,
                    severity=st.published_severity,
                    direction=direction,
                )

        return SmoothedHand(hand=hand, criteria=criteria)

    def _update_direction(
        self,
        st: _CriterionState,
        t_ms: int,
        metric: float | None,
        ideal: list[float] | None,
    ) -> str:
        if metric is None or not math.isfinite(metric) or ideal is None or len(ideal) < 2:
            st.pending_direction = None
            st.pending_direction_since = None
            return "generic"

        lo, hi = ideal[0], ideal[1]
        if lo <= metric <= hi:
            st.pending_direction = None
            st.pending_direction_since = None
            if st.published_direction is None:
                st.published_direction = "generic"
                return "generic"
            return st.published_direction

        side = "too_low" if metric < lo else "too_high"
        if st.published_direction is None:
            st.published_direction = side
            return side

        if side == st.published_direction:
            st.pending_direction = None
            st.pending_direction_since = None
            return st.published_direction

        if st.pending_direction != side:
            st.pending_direction = side
            st.pending_direction_since = t_ms
            return st.published_direction

        if (
            st.pending_direction_since is not None
            and t_ms - st.pending_direction_since >= self._dwell_ms
        ):
            st.published_direction = side
            st.pending_direction = None
            st.pending_direction_since = None
            return side

        return st.published_direction
