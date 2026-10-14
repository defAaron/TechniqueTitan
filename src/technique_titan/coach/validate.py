"""Validate coach tip strings before show or persist (spec §3.3)."""

from __future__ import annotations

import math
import re
import unicodedata
from pathlib import Path

import yaml

GUARDS_PATH = Path(__file__).resolve().parents[3] / "config" / "coach_direction_guards.yaml"

LENGTH_CAPS = {"live": 220, "photo": 320, "recap": 480}

ALLOW_WORDS: dict[str, tuple[str, ...]] = {
    "wrist_height": ("wrist", "knuckle"),
    "finger_curvature": ("finger", "curve", "round"),
    "thumb_position": ("thumb",),
    "wrist_lateral": ("wrist", "side"),
    "hand_arch": ("arch", "knuckle", "palm"),
}

DENY_WORDS = (
    "diagnos",
    "injur",
    "doctor",
    "medical",
    "pain",
    "surgery",
    "arthritis",
)

MARKDOWN_CHARS = frozenset("#*`[]")
NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")

_loaded_guards: dict | None = None


def _load_guards_from_disk() -> dict:
    global _loaded_guards
    if _loaded_guards is None:
        with open(GUARDS_PATH, encoding="utf-8") as f:
            _loaded_guards = yaml.safe_load(f) or {}
    return _loaded_guards


def _sentence_terminator_indices(text: str) -> list[int]:
    indices: list[int] = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch in "!?":
            indices.append(i)
            i += 1
        elif ch == ".":
            if i > 0 and i + 1 < n and text[i - 1].isdigit() and text[i + 1].isdigit():
                i += 1
            else:
                indices.append(i)
                i += 1
        else:
            i += 1
    return indices


def _count_sentences(text: str) -> int:
    stripped = text.strip()
    if not stripped:
        return 0
    ends = _sentence_terminator_indices(stripped)
    if not ends:
        return 1
    tail = stripped[ends[-1] + 1 :].strip()
    return len(ends) + (1 if tail else 0)


def _has_markdown_heading_line(text: str) -> bool:
    for line in text.splitlines():
        if re.match(r"^\s*#+\s", line):
            return True
    return False


def _has_markdown(text: str) -> bool:
    if any(ch in MARKDOWN_CHARS for ch in text):
        return True
    return _has_markdown_heading_line(text)


def _is_emoji_char(ch: str) -> bool:
    if not ch:
        return False
    code = ord(ch)
    if 0x1F300 <= code <= 0x1FAFF:
        return True
    if 0x2600 <= code <= 0x27BF:
        return True
    return unicodedata.category(ch) == "So"


def _has_emoji(text: str) -> bool:
    return any(_is_emoji_char(ch) for ch in text)


def _number_allowed(value: float, plan: dict) -> bool:
    score = plan.get("score")
    if score is not None:
        try:
            if abs(value - float(score)) <= 2:
                return True
        except (TypeError, ValueError):
            pass
    metric_value = plan.get("metric_value")
    if metric_value is not None:
        try:
            if abs(value - float(metric_value)) <= 0.05:
                return True
        except (TypeError, ValueError):
            pass
    for bound in plan.get("ideal") or []:
        try:
            if math.isclose(value, float(bound), abs_tol=1e-4):
                return True
        except (TypeError, ValueError):
            continue
    return False


def _direction_phrases(plan: dict, guards: dict) -> list[str]:
    criterion = plan.get("criterion")
    direction = plan.get("direction")
    if not criterion or not direction:
        return []
    crit_guards = guards.get(criterion) or {}
    if not isinstance(crit_guards, dict):
        return []
    phrases = crit_guards.get(direction) or []
    if not isinstance(phrases, list):
        return []
    return [str(p) for p in phrases if p]


def validate_tip(text: str, plan: dict, *, guards: dict | None = None) -> list[str]:
    """Return rejection codes; empty list means the tip passes."""
    codes: list[str] = []
    stripped = text.strip()
    if not stripped:
        return ["empty"]

    sentence_count = _count_sentences(stripped)
    if sentence_count > 2:
        codes.append("sentences")

    if _has_markdown(stripped):
        codes.append("markdown")

    if _has_emoji(stripped):
        codes.append("emoji")

    tip_kind = plan.get("tip_kind") or "live"
    cap = LENGTH_CAPS.get(tip_kind, LENGTH_CAPS["live"])
    if len(stripped) > cap:
        codes.append("length")

    criterion = plan.get("criterion") or ""
    lowered = stripped.casefold()
    allow = ALLOW_WORDS.get(criterion, ())
    if allow and not any(word in lowered for word in allow):
        codes.append("allow_word")

    if any(word in lowered for word in DENY_WORDS):
        codes.append("deny_word")

    for match in NUMBER_RE.finditer(stripped):
        num = float(match.group())
        if not _number_allowed(num, plan):
            codes.append("number")
            break

    guard_cfg = guards if guards is not None else _load_guards_from_disk()
    for phrase in _direction_phrases(plan, guard_cfg):
        if phrase.casefold() in lowered:
            codes.append("direction_guard")
            break

    return codes
