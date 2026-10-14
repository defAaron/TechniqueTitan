"""Coach training-set tools: seed rows, drafter CLI, output path guard."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pytest

from technique_titan.coach import draft_paraphrases as dp
from technique_titan.coaching import load_coaching_config

REPO_ROOT = Path(__file__).resolve().parents[2]
ACCEPTED = REPO_ROOT / "data" / "coach" / "accepted.jsonl"
PROBE = REPO_ROOT / "data" / "coach" / "probe.jsonl"


def _rows(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


@pytest.fixture(scope="module")
def coaching_config():
    return load_coaching_config()


@pytest.mark.parametrize("path", [ACCEPTED, PROBE], ids=["accepted", "probe"])
def test_every_line_passes_validator(path):
    rows = _rows(path)
    assert rows
    for row in rows:
        roles = [m["role"] for m in row["messages"]]
        assert roles == ["system", "user", "assistant"]
        assert row["messages"][0]["content"] == dp.SYSTEM_PROMPT
        plan = dp.plan_from_row(row)
        assert set(plan) == set(dp.PLAN_USER_KEYS)
        tip = dp.tip_from_row(row)
        assert tip is not None
        assert dp.tip_errors(tip, plan) == [], (plan, tip)


def test_accepted_seed_covers_every_cell():
    cells = Counter(
        (p["criterion"], p["severity"], p["direction"])
        for p in map(dp.plan_from_row, _rows(ACCEPTED))
    )
    expected = {(c, s, d) for c in dp.CRITERIA for s in dp.SEVERITIES for d in dp.DIRECTIONS}
    assert expected <= set(cells)


def test_seed_rows_match_accepted_prefix(coaching_config):
    seeded = dp.seed_rows(coaching_config)
    assert _rows(ACCEPTED)[: len(seeded)] == seeded


def test_probe_has_25_plans_not_in_accepted():
    probe_users = [r["messages"][1]["content"] for r in _rows(PROBE)]
    accepted_users = {r["messages"][1]["content"] for r in _rows(ACCEPTED)}
    assert len(probe_users) == 25
    assert len(set(probe_users)) == 25
    assert not set(probe_users) & accepted_users


def test_user_message_drops_extra_plan_fields():
    plan = {
        "criterion": "wrist_height",
        "severity": "warning",
        "direction": "too_high",
        "score": 62,
        "tip_kind": "live",
        "history": [{"x": 1}],
        "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "metric_value": 1.12,
    }
    assert json.loads(dp.user_message(plan)) == {
        "criterion": "wrist_height",
        "severity": "warning",
        "direction": "too_high",
        "score": 62,
        "tip_kind": "live",
    }


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ('{"problem": "A.", "fix": "B."}', {"problem": "A.", "fix": "B."}),
        ('Sure! {"problem": " A. ", "fix": "B."} done', {"problem": "A.", "fix": "B."}),
        ("not json", None),
        ('{"problem": "A."}', None),
        ('{"problem": "", "fix": "B."}', None),
        ('{"problem": 1, "fix": "B."}', None),
        ("[1, 2]", None),
    ],
)
def test_parse_tip(text, expected):
    assert dp.parse_tip(text) == expected


def _fake_generator(replies: list[str]):
    calls: list[list[dict]] = []

    def generate(messages: list[dict]) -> str:
        calls.append(messages)
        return replies[(len(calls) - 1) % len(replies)]

    return generate, calls


def test_draft_rows_keep_only_distinct_valid_drafts(coaching_config):
    good = json.dumps({"problem": "Your wrist is a bit off.", "fix": "Keep the wrist level."})
    bad = json.dumps({"problem": "See a doctor.", "fix": "Rest the hand."})
    generate, calls = _fake_generator([good, bad, good, "garbage"])
    rows = list(dp.draft_rows(coaching_config, generate, per_cell=4))

    cells = list(dp.iter_cells(coaching_config))
    assert len(calls) == 4 * len(cells)
    for row in rows:
        plan = dp.plan_from_row(row)
        assert dp.tip_errors(dp.tip_from_row(row), plan) == []
    keys = [(r["messages"][1]["content"], r["messages"][2]["content"]) for r in rows]
    assert len(keys) == len(set(keys))
    # Only wrist criteria accept "wrist"; one distinct draft survives per such cell.
    wrist_cells = [p for p, _ in cells if p["criterion"] in ("wrist_height", "wrist_lateral")]
    assert len(rows) == len(wrist_cells)


def test_draft_prompt_carries_plan_and_template_only(coaching_config):
    generate, calls = _fake_generator(["{}"])
    list(dp.draft_rows(coaching_config, generate, per_cell=1))
    payload = json.loads(calls[0][1]["content"])
    assert set(payload) == {"plan", "tip"}
    assert set(payload["plan"]) == set(dp.PLAN_USER_KEYS)


def test_cli_writes_drafts_with_injected_generator(coaching_config):
    reply = json.dumps({"problem": "Your thumb drifts a little.", "fix": "Let the thumb rest."})
    generate, _ = _fake_generator([reply])
    out = dp.DRAFTS_DIR / "pytest_cli.jsonl"
    try:
        code = dp.main(
            [
                "--model",
                dp.ALLOWED_MODEL,
                "--output",
                "data/coach/drafts/pytest_cli.jsonl",
                "--per-cell",
                "1",
            ],
            generator=generate,
        )
        assert code == 0
        rows = _rows(out)
        assert rows
        assert {dp.plan_from_row(r)["criterion"] for r in rows} == {"thumb_position"}
    finally:
        out.unlink(missing_ok=True)


def test_cli_refuses_other_models(capsys):
    generate, calls = _fake_generator(["{}"])
    code = dp.main(
        ["--model", "Qwen/Qwen2.5-7B-Instruct", "--output", "data/coach/drafts/x.jsonl"],
        generator=generate,
    )
    assert code == 2
    assert calls == []
    assert dp.ALLOWED_MODEL in capsys.readouterr().err


@pytest.mark.parametrize(
    "path",
    [
        "data/coach/drafts/../../.env",
        "data/coach/accepted.jsonl",
        "data/coach/drafts",
        "/tmp/base.jsonl",
        "../data/coach/drafts/base.jsonl",
    ],
)
def test_output_outside_drafts_is_rejected(path):
    with pytest.raises(ValueError):
        dp.resolve_output(path)


def test_cli_rejects_path_escape_before_generating():
    generate, calls = _fake_generator(["{}"])
    code = dp.main(
        ["--model", dp.ALLOWED_MODEL, "--output", "data/coach/drafts/../../.env"],
        generator=generate,
    )
    assert code == 2
    assert calls == []


def test_output_inside_drafts_is_allowed():
    resolved = dp.resolve_output("data/coach/drafts/base.jsonl")
    assert resolved == (dp.DRAFTS_DIR / "base.jsonl").resolve()
