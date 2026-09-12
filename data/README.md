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
notebook does not overwrite YAML. There is no published hold-out ≥85% figure
yet; the harness is how that number will be measured. See
[`docs/ML_UPGRADE.md`](../docs/ML_UPGRADE.md).
