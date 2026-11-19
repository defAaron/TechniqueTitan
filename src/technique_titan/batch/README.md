# Batch CLI

Scores every image under a folder the same way the API scores a photo. Used to build `data/processed/batch_summary.csv` for eval and for the offline trainer. It is not on the request path.

```sh
python -m technique_titan.batch.process_folder \
  --input data/raw \
  --output data/processed \
  --labels data/labels.csv
```

Run from the repo `.venv` (`pip install -e .`, Python 3.11).

## Per image

1. Read with OpenCV. Extensions: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.webp`. Subfolders are kept in the output name (`excellent/1.png`).
2. `HandDetector` (static image mode, up to two hands, anatomical labels).
3. `extract_all_features` → `score_all` against `config/scoring.yaml`.
4. `resolve_labels` so two hands that share a MediaPipe side still get distinct Left/Right columns.

## Outputs

| Path | Contents |
|---|---|
| `landmarks/<name>.json` | Raw coordinates, `hands` list |
| `metrics/<name>.json` | Vectors, angles, metrics, scores, `hands` list |
| `batch_summary.csv` | One row per detected hand (`source`, `hand`, `hand_index`, every feature) |
| `outliers.csv` | Low confidence, implausible joint angles, or a metric more than 3 standard deviations from the batch mean (thresholds in `scoring.yaml` `outliers:`) |
| `failed/failures.csv` | Images with no hand, and why |

`--labels` joins `data/labels.csv` **by filename only**. The same expert row is copied onto every hand from that image. Hand-aware matching (`left` / `right` / `both`) happens later in [`eval`](../eval/README.md).

`data/processed/` is gitignored. `data/raw/` is gitignored. CI does not run this CLI.

Label source and folder layout: [`data/README.md`](../../../../data/README.md).
