# Data intake

Drop your raw hand images anywhere under `raw/` (subfolders are fine and are
preserved in the output names — grouping by posture type is a handy
convention, e.g. `raw/collapsed_wrist/`, `raw/good_posture/`).

Optionally add a `labels.csv` in this folder (see `labels_template.csv`) with
your expert severity labels; they get merged into `processed/batch_summary.csv`
so scores can be compared against your judgments.

Then run one command from the project root:

```bash
.venv/bin/python -m technique_titan.batch.process_folder \
  --input data/raw --output data/processed --labels data/labels.csv
```

Outputs land in `processed/`:

- `landmarks/` — raw MediaPipe coordinates, one JSON per image
- `metrics/` — vectors, joint angles, criterion metrics, scores per image
- `batch_summary.csv` — one row per image with every computed feature
- `outliers.csv` — auto-flagged rows worth a manual look
- `failed/failures.csv` — images with no detectable hand, with reasons
