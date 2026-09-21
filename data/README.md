# Data intake

Batch dataset layout for the Technique Titan CLI
(`python -m technique_titan.batch.process_folder`, then
`python -m technique_titan.eval`). Requires the package
installed (`pip install -e .`) and preferably Python 3.11.

Drop your raw hand images anywhere under `raw/` (subfolders are fine and are
preserved in the output names). For this project, images are grouped by
overall posture quality:

- `raw/excellent/` — numbered `1.png`, `2.png`, …
- `raw/good/`
- `raw/warning/`
- `raw/critical/`

Additional labeled paths use the same severity folders with an `f` prefix
(`fexcellent/`, `fgood/`, `fwarning/`, `fcritical/`). Geometry for those
rows lives in `synthetic/feature_rows.csv` (same columns as
`processed/batch_summary.csv`) so the offline trainer can run without a
MediaPipe batch.

Ad-hoc smoke images (not part of the labeled set) live in `fixtures/`
(for example `fixtures/smoke_test/` and `fixtures/test_one.jpg`). Keep
severity folders under `raw/` for expert-labeled batch runs only.

## Labeling (Notion)

**The classification table lives in Notion**, not in git. Page title:
`techniquetitan` — https://app.notion.com/p/3c68fa97c1488038b113e233ad10f278

Columns match `labels_template.csv`:

`filename`, `hand`, `wrist_height`, `finger_curvature`, `thumb_position`,
`wrist_lateral`, `hand_arch`, `notes`

**Agents:** use the Notion MCP (`user-notion`) to search for `techniquetitan`,
`notion-fetch` the page table, and `notion-update-page` to complete labeling.
See [`AGENTS.md`](../AGENTS.md) for the full MCP workflow.

**Humans:** edit the table in Notion directly.

**Batch merge:** export the Notion table to `data/labels.csv` (same column
headers as `labels_template.csv`) before running the batch command below.
Labels get merged into `processed/batch_summary.csv` so scores can be compared
against expert judgments.

Then from the project root:

```bash
python -m technique_titan.batch.process_folder \
  --input data/raw --output data/processed --labels data/labels.csv
```

Both hands are detected and scored separately. Outputs land in `processed/`:

- `landmarks/` — raw MediaPipe coordinates, one JSON per image (a `hands` list)
- `metrics/` — vectors, joint angles, criterion metrics, scores per image (a `hands` list)
- `batch_summary.csv` — one row **per detected hand** (`source` + `hand` + `hand_index`) with every computed feature
- `outliers.csv` — auto-flagged rows worth a manual look
- `failed/failures.csv` — images with no detectable hand, with reasons

**Batch vs eval merge:** the batch CLI still joins `labels.csv` by **filename
only**, so one label row is copied onto every detected hand from that image.
The eval CLI is **hand-aware**: `hand` of `left` or `right` matches that
detected hand; `both` applies to both hands in the image. `labels_template.csv`
in this folder is a **schema reference** only — keep the live labels in Notion.

## Evaluation report

Pipeline: Notion export → `data/labels.csv` → batch (`processed/batch_summary.csv`)
→ eval report. Requires local `data/raw/` (gitignored); CI does not run this
MediaPipe batch.

```bash
python -m technique_titan.eval \
  --summary data/processed/batch_summary.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --output data/eval/reports
```

Writes per-criterion accuracy, Cohen’s κ, and confusion matrices under
`data/eval/reports/` (gitignored). The train/hold-out ids live in
`data/eval/holdout_split.json` (tracked — do not regenerate casually).

Threshold search is `notebooks/scoring_tuning.ipynb`: candidates on TRAIN
only; promote `config/scoring.yaml` only if HOLD-OUT agreement rises. The
notebook does not overwrite YAML. After the 2026-09-19 train-only promotion,
local heuristic hold-out **macro accuracy is 0.689** (target ≥85% / NFR-ACC-2
still open). Re-run eval after each export. See
[`docs/ML_UPGRADE.md`](../docs/ML_UPGRADE.md).

## Offline classical ML

Geometry features plus expert labels train one multinomial logistic
regression per criterion. Production scoring is unchanged (YAML heuristics).
How the math works and why it helps: [`docs/ML_LOGISTIC_REGRESSION.md`](../docs/ML_LOGISTIC_REGRESSION.md).

Use the repo `.venv` (`source .venv/bin/activate` or `.venv/bin/python -m …`).
Requires `pip install -e ".[ml]"`.

```bash
python -m technique_titan.ml.synthetic \
  --labels data/labels.csv \
  --output data/synthetic/feature_rows.csv

python -m technique_titan.ml.train \
  --labels data/labels.csv \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --split data/eval/holdout_split.json \
  --output config/models

python -m technique_titan.eval \
  --scorer compare \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --models config/models \
  --output data/eval/reports
```

`batch_summary.csv` is optional if you only have the companion feature table.
`f*` filenames in `holdout_split.json` stay on the train side; the original
hold-out image ids are frozen. Models under `config/models/` are gitignored
and regenerated by the train CLI. `--summary` is optional when only the
companion feature table is present.
