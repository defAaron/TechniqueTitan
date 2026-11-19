# Notebooks

`scoring_tuning.ipynb` searches `ideal` and `limit` bands for the five criteria.

The search fits on **TRAIN** ids only. It then scores the frozen hold-out and prints whether macro accuracy rose. It does not write `config/scoring.yaml`. Copying a candidate into that file is a separate, deliberate edit, done only when hold-out agreement goes up. The 2026-09-19 file in `config/` is the last promotion (0.622 → 0.689 macro).

Run it from the repo `.venv` with the package installed, after a batch summary exists at `data/processed/batch_summary.csv`. The notebook is research, not a request-path dependency. Agreement math lives in [`src/technique_titan/eval`](../src/technique_titan/eval/README.md).
