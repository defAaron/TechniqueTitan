"""Locate the Technique Titan repo root from cwd or this file."""

from __future__ import annotations

from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    """Walk up looking for ``pyproject.toml`` or ``config/scoring.yaml``."""
    origins: list[Path] = []
    if start is not None:
        origins.append(Path(start).resolve())
    origins.append(Path.cwd().resolve())
    origins.append(Path(__file__).resolve())

    seen: set[Path] = set()
    for origin in origins:
        for candidate in [origin, *origin.parents]:
            if candidate in seen:
                continue
            seen.add(candidate)
            if (candidate / "pyproject.toml").is_file() or (
                candidate / "config" / "scoring.yaml"
            ).is_file():
                return candidate
    raise FileNotFoundError(
        "Could not locate repo root (no pyproject.toml or config/scoring.yaml)"
    )
