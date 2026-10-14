"""Draft paraphrases of coaching templates with the base MLX model (spec §5.2).

Drafts are unreviewed. A human moves kept lines into
``data/coach/accepted.jsonl``; training never reads ``data/coach/drafts/``.

Run locally on Apple Silicon only (``.venv-coach``)::

    python -m technique_titan.coach.draft_paraphrases \\
      --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \\
      --templates config/coaching.yaml \\
      --output data/coach/drafts/base.jsonl \\
      --per-cell 8
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

from technique_titan.coach.validate import validate_tip
from technique_titan.coaching import load_coaching_config

REPO_ROOT = Path(__file__).resolve().parents[3]
DRAFTS_DIR = REPO_ROOT / "data" / "coach" / "drafts"

ALLOWED_MODEL = "mlx-community/Qwen2.5-0.5B-Instruct-4bit"

SYSTEM_PROMPT = (
    "You write one piano posture tip for a child. Use only the facts in the plan. "
    "Return JSON with keys problem and fix."
)

DRAFT_SYSTEM_PROMPT = (
    "You rewrite one piano posture tip for a child. Keep the same meaning and the "
    "same body parts. Use plain words, no numbers, no medical words. "
    "Return only JSON with keys problem and fix."
)

CRITERIA = ("wrist_height", "finger_curvature", "thumb_position", "wrist_lateral", "hand_arch")
SEVERITIES = ("warning", "critical")
DIRECTIONS = ("too_low", "too_high", "generic")
TIP_KINDS = ("live", "photo", "recap")
PLAN_USER_KEYS = ("criterion", "severity", "direction", "score", "tip_kind")

SEED_SCORES = {"warning": 65, "critical": 35}

Generator = Callable[[list[dict]], str]


def user_plan(plan: dict) -> dict:
    """The short plan the model sees: no history, ids, or metrics."""
    return {key: plan[key] for key in PLAN_USER_KEYS}


def user_message(plan: dict) -> str:
    return json.dumps(user_plan(plan), separators=(",", ":"))


def training_row(plan: dict, problem: str, fix: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message(plan)},
            {
                "role": "assistant",
                "content": json.dumps({"problem": problem, "fix": fix}, ensure_ascii=False),
            },
        ]
    }


def plan_from_row(row: dict) -> dict:
    """Recover the short plan from a training row's user message."""
    for message in row["messages"]:
        if message["role"] == "user":
            return json.loads(message["content"])
    raise ValueError("row has no user message")


def tip_from_row(row: dict) -> dict | None:
    for message in row["messages"]:
        if message["role"] == "assistant":
            return parse_tip(message["content"])
    return None


def parse_tip(text: str) -> dict | None:
    """Extract ``{problem, fix}`` from model text; None if absent or malformed."""
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        obj = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    problem, fix = obj.get("problem"), obj.get("fix")
    if not isinstance(problem, str) or not isinstance(fix, str):
        return None
    problem, fix = problem.strip(), fix.strip()
    if not problem or not fix:
        return None
    return {"problem": problem, "fix": fix}


def tip_errors(tip: dict, plan: dict) -> list[str]:
    """Same joined check the API applies to template copy."""
    return validate_tip(f"{tip['problem']} {tip['fix']}", plan)


def _cell_template(coaching_config: dict, criterion: str, severity: str, direction: str) -> dict:
    cell = coaching_config["criteria"][criterion][severity][direction]
    variants = cell.get("variants")
    if isinstance(variants, list) and variants:
        return variants[0]
    return {"problem": cell["problem"], "fix": cell["fix"]}


def iter_cells(
    coaching_config: dict, tip_kinds: tuple[str, ...] = TIP_KINDS
) -> Iterator[tuple[dict, dict]]:
    """Yield ``(plan, template)`` for every criterion × severity × direction × tip_kind."""
    for criterion in CRITERIA:
        for severity in SEVERITIES:
            for direction in DIRECTIONS:
                template = _cell_template(coaching_config, criterion, severity, direction)
                for tip_kind in tip_kinds:
                    plan = {
                        "criterion": criterion,
                        "severity": severity,
                        "direction": direction,
                        "score": SEED_SCORES[severity],
                        "tip_kind": tip_kind,
                    }
                    yield plan, template


def seed_rows(coaching_config: dict) -> list[dict]:
    """One template-only row per (criterion, severity, direction) from ``variants[0]``."""
    rows = []
    for plan, template in iter_cells(coaching_config, tip_kinds=("live",)):
        if tip_errors(template, plan):
            raise ValueError(f"template fails validation: {plan}")
        rows.append(training_row(plan, template["problem"], template["fix"]))
    return rows


def draft_messages(plan: dict, template: dict) -> list[dict]:
    payload = {"plan": user_plan(plan), "tip": template}
    return [
        {"role": "system", "content": DRAFT_SYSTEM_PROMPT},
        {"role": "user", "content": json.dumps(payload, separators=(",", ":"))},
    ]


def draft_rows(coaching_config: dict, generate: Generator, per_cell: int) -> Iterator[dict]:
    """Ask ``generate`` ``per_cell`` times per cell; keep distinct validator-passing drafts."""
    for plan, template in iter_cells(coaching_config):
        seen = {(template["problem"], template["fix"])}
        messages = draft_messages(plan, template)
        for _ in range(per_cell):
            tip = parse_tip(generate(messages))
            if tip is None or tip_errors(tip, plan):
                continue
            key = (tip["problem"], tip["fix"])
            if key in seen:
                continue
            seen.add(key)
            yield training_row(plan, tip["problem"], tip["fix"])


def resolve_output(path: str | Path) -> Path:
    """Resolve ``path`` and require it to stay under ``data/coach/drafts/``."""
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    resolved = candidate.resolve()
    drafts = DRAFTS_DIR.resolve()
    if resolved == drafts or drafts not in resolved.parents:
        raise ValueError(f"output must be a file under {drafts}")
    return resolved


def mlx_generator(model_id: str) -> Generator:  # pragma: no cover - needs MLX
    from mlx_lm import generate, load
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = load(model_id)
    sampler = make_sampler(temp=0.7, top_p=0.9)

    def _generate(messages: list[dict]) -> str:
        prompt = tokenizer.apply_chat_template(messages, add_generation_prompt=True)
        return generate(model, tokenizer, prompt=prompt, max_tokens=64, sampler=sampler)

    return _generate


def write_jsonl(rows, output: Path) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(output, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            count += 1
    return count


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", required=True)
    parser.add_argument("--templates", default="config/coaching.yaml")
    parser.add_argument("--output", required=True)
    parser.add_argument("--per-cell", type=int, default=8)
    return parser


def main(argv: list[str] | None = None, *, generator: Generator | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.model != ALLOWED_MODEL:
        print(f"--model must be {ALLOWED_MODEL}", file=sys.stderr)
        return 2
    if args.per_cell < 1:
        print("--per-cell must be at least 1", file=sys.stderr)
        return 2
    try:
        output = resolve_output(args.output)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    coaching_config = load_coaching_config(args.templates)
    generate = generator or mlx_generator(args.model)
    count = write_jsonl(draft_rows(coaching_config, generate, args.per_cell), output)
    print(f"wrote {count} unreviewed drafts to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
