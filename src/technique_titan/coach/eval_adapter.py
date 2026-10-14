"""Score a LoRA coaching adapter and gate export (spec §5.4, §6.3).

Two subcommands, both local-only:

    python -m technique_titan.coach.eval_adapter split
    python -m technique_titan.coach.eval_adapter eval \\
      --adapter-path data/coach/adapters

``split`` writes ``data/coach/split/{train,valid}.jsonl`` (gitignored, derived)
and ``data/coach/split.json`` (dev line numbers). ``eval`` runs the adapter on
the dev rows and ``probe.jsonl``; the gate passes only when the validator pass
rate is at least 0.95 on both.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from technique_titan.coach.draft_paraphrases import (
    ALLOWED_MODEL,
    REPO_ROOT,
    plan_from_row,
    parse_tip,
    tip_errors,
    tip_from_row,
)

COACH_DIR = REPO_ROOT / "data" / "coach"
ACCEPTED = COACH_DIR / "accepted.jsonl"
PROBE = COACH_DIR / "probe.jsonl"
SPLIT_DIR = COACH_DIR / "split"
SPLIT_INDEX = COACH_DIR / "split.json"

GATE_MIN_PASS_RATE = 0.95
DEV_FRACTION = 0.1

Completer = Callable[[list[dict]], str]


@dataclass(frozen=True)
class EvalResult:
    n: int
    passed: int
    exact: int

    @property
    def pass_rate(self) -> float:
        return self.passed / self.n if self.n else 0.0

    @property
    def exact_rate(self) -> float:
        return self.exact / self.n if self.n else 0.0


def read_jsonl(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def write_jsonl(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _cell(row: dict) -> tuple[str, str, str, str]:
    plan = plan_from_row(row)
    return (plan["criterion"], plan["severity"], plan["direction"], plan["tip_kind"])


def split_by_cell(
    rows: list[dict], *, dev_fraction: float = DEV_FRACTION, seed: int = 0
) -> list[int]:
    """Dev row indices: about ``dev_fraction`` of each cell, at least one per cell of ≥ 2 rows."""
    by_cell: dict[tuple, list[int]] = defaultdict(list)
    for i, row in enumerate(rows):
        by_cell[_cell(row)].append(i)
    rng = random.Random(seed)
    dev: list[int] = []
    for cell in sorted(by_cell):
        indices = by_cell[cell]
        if len(indices) < 2:
            continue
        k = max(1, round(len(indices) * dev_fraction))
        dev.extend(rng.sample(indices, k))
    return sorted(dev)


def prompt_messages(row: dict) -> list[dict]:
    return [m for m in row["messages"] if m["role"] != "assistant"]


def evaluate(rows: list[dict], complete: Completer) -> EvalResult:
    passed = exact = 0
    for row in rows:
        try:
            tip = parse_tip(complete(prompt_messages(row)))
        except Exception:
            tip = None
        if tip is None:
            continue
        if not tip_errors(tip, plan_from_row(row)):
            passed += 1
        if tip == tip_from_row(row):
            exact += 1
    return EvalResult(n=len(rows), passed=passed, exact=exact)


def gate_passes(
    dev: EvalResult, probe: EvalResult, *, threshold: float = GATE_MIN_PASS_RATE
) -> bool:
    if dev.n == 0 or probe.n == 0:
        return False
    return dev.passed >= threshold * dev.n and probe.passed >= threshold * probe.n


def mlx_completer(model_id: str, adapter_path: Path) -> Completer:  # pragma: no cover - needs MLX
    from mlx_lm import generate, load
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = load(model_id, adapter_path=str(adapter_path))
    sampler = make_sampler(temp=0.7, top_p=0.9)

    def _complete(messages: list[dict]) -> str:
        prompt = tokenizer.apply_chat_template(messages, add_generation_prompt=True)
        return generate(model, tokenizer, prompt=prompt, max_tokens=64, sampler=sampler)

    return _complete


def _format(name: str, result: EvalResult) -> str:
    return (
        f"{name}: n={result.n} validator_pass={result.pass_rate:.3f} "
        f"exact_match={result.exact_rate:.3f}"
    )


def run_split(accepted: Path = ACCEPTED, out_dir: Path = SPLIT_DIR, index: Path = SPLIT_INDEX) -> int:
    rows = read_jsonl(accepted)
    dev = set(split_by_cell(rows))
    write_jsonl([r for i, r in enumerate(rows) if i not in dev], out_dir / "train.jsonl")
    write_jsonl([r for i, r in enumerate(rows) if i in dev], out_dir / "valid.jsonl")
    index.write_text(json.dumps({"seed": 0, "dev_lines": sorted(dev)}, indent=2) + "\n")
    print(f"train={len(rows) - len(dev)} dev={len(dev)} -> {out_dir}")
    return 0


def run_eval(
    dev_path: Path,
    probe_path: Path,
    complete: Completer,
) -> int:
    dev = evaluate(read_jsonl(dev_path), complete)
    probe = evaluate(read_jsonl(probe_path), complete)
    print(_format("dev", dev))
    print(_format("probe", probe))
    passed = gate_passes(dev, probe)
    print(f"gate: {'PASS' if passed else 'FAIL'} (needs >= {GATE_MIN_PASS_RATE} on both)")
    return 0 if passed else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("split", help="Split accepted.jsonl 90/10 by cell")
    ev = sub.add_parser("eval", help="Run the adapter on dev + probe and apply the gate")
    ev.add_argument("--model", default=ALLOWED_MODEL)
    ev.add_argument("--adapter-path", default="data/coach/adapters")
    ev.add_argument("--dev", default=str(SPLIT_DIR / "valid.jsonl"))
    ev.add_argument("--probe", default=str(PROBE))
    return parser


def main(argv: list[str] | None = None, *, completer: Completer | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "split":
        return run_split()
    if args.model != ALLOWED_MODEL:
        print(f"--model must be {ALLOWED_MODEL}", file=sys.stderr)
        return 2
    complete = completer or mlx_completer(args.model, REPO_ROOT / args.adapter_path)
    return run_eval(Path(args.dev), Path(args.probe), complete)


if __name__ == "__main__":
    raise SystemExit(main())
