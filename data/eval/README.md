# Frozen hold-out

`holdout_split.json` is the list of image ids that scoring changes are judged on. It is tracked. `reports/` is gitignored and is whatever the last local `python -m technique_titan.eval` wrote.

The hold-out is **10 real image ids**. Filenames with the synthetic `f` prefix are train-only even if someone regenerates a split. Do not reshuffle this file to chase a higher accuracy number; a new split would make the 0.689 baseline incomparable.

How the report is computed: [`src/technique_titan/eval/README.md`](../../src/technique_titan/eval/README.md).
