"""Frozen filename-level train / hold-out split."""

from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path

from .labels import load_labels


def _stratum(filename: str) -> str:
    parts = Path(filename.replace("\\", "/")).parts
    if len(parts) > 1:
        return parts[0]
    return "_unstratified"


def _holdout_count(n: int, holdout_fraction: float) -> int:
    """Keep both sides non-empty when a folder has 2+ files; singletons stay in train."""
    if n <= 1:
        return 0
    n_holdout = int(round(n * holdout_fraction))
    return min(max(n_holdout, 1), n - 1)


def _unique_filenames(labels_path: Path) -> list[str]:
    seen: set[str] = set()
    filenames: list[str] = []
    for row in load_labels(labels_path):
        name = row["filename"]
        if name not in seen:
            seen.add(name)
            filenames.append(name)
    return filenames


def _create_split(
    filenames: list[str],
    *,
    seed: int,
    holdout_fraction: float,
) -> dict:
    groups: dict[str, list[str]] = defaultdict(list)
    for name in filenames:
        groups[_stratum(name)].append(name)

    rng = random.Random(seed)
    train: list[str] = []
    holdout: list[str] = []
    for key in sorted(groups):
        items = sorted(groups[key])
        rng.shuffle(items)
        n_holdout = _holdout_count(len(items), holdout_fraction)
        holdout.extend(items[:n_holdout])
        train.extend(items[n_holdout:])

    return {
        "seed": seed,
        "holdout_fraction": holdout_fraction,
        "train": sorted(train),
        "holdout": sorted(holdout),
    }


def load_or_create_split(
    labels_path: Path,
    split_path: Path,
    *,
    seed: int = 42,
    holdout_fraction: float = 0.30,
) -> dict:
    """Return ``{"seed", "holdout_fraction", "train", "holdout"}``.

    Split by **filename** (not hand-row). Stratify by first path component
    (excellent/good/warning/critical) when present. If split_path exists, load it
    and do not reshuffle. Write it when creating. Filenames sorted in each list.
    """
    split_path = Path(split_path)
    if split_path.is_file():
        with open(split_path, encoding="utf-8") as handle:
            return json.load(handle)

    payload = _create_split(
        _unique_filenames(labels_path),
        seed=seed,
        holdout_fraction=holdout_fraction,
    )
    split_path.parent.mkdir(parents=True, exist_ok=True)
    split_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload
