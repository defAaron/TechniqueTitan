# Engine (`technique_titan`)

Shared piano-posture library. The React app, the FastAPI process, Streamlit, and the batch CLI all call into this package. It does not know about HTTP, Supabase, or the browser.

Import path: `technique_titan` (source root `src/`). Version in `__init__.py` is `0.1.0`.

## Pipeline

```text
BGR image or 21 landmarks
  → detection.HandDetector          (server images only)
  → analysis.analyze_hands          (or score_detected_hands for browser landmarks)
  → geometry.normalize_landmarks    (wrist origin, palm span = 1)
  → features.extract_all_features   (five criteria)
  → scoring.score_all               (config/scoring.yaml)
  → coaching.generate_coaching      (config/coaching.yaml)
  → coach.plan / coach.focus        (one sentence, weekly lock)
  → progress.reducer                (compact session draft)
```

World landmarks (meters, origin at the hand) are used for the math when MediaPipe returns them. Image-normalized landmarks are the fallback, and they are also what the overlay draws.

## Package root (not in a subfolder)

| File | Role |
|---|---|
| `analysis.py` | `analyze_hands`, `score_detected_hands`, `resolve_labels`, `draw_all_overlays`. One `AnalysisResult` per hand: metrics, scores, severities, composite, angles. Skeleton color is the worst severity (green / orange / red). |
| `scoring.py` | Piecewise-linear map. 100 inside `ideal`, 0 at or beyond `limit`, linear between. Composite is the weighted mean of finite scores. |
| `coaching.py` | Template tips. Does not change scores. `metric_direction` returns `too_low`, `too_high`, or `generic`. `lookup_variant` picks one of four daily variants with SHA-256(user id, plan key, date) when the YAML cell has exactly four variants. `CRITERION_LANDMARKS` is the set the overlay emphasizes for the primary tip. |

`resolve_labels` keeps MediaPipe’s handedness when the two hands already differ. When both come back as the same side, the smaller wrist x is labeled Right and the other Left. That split is a front-camera heuristic; it exists so the two scorecards stay distinct.

## Subpackages

| Folder | README |
|---|---|
| `detection/` | [MediaPipe wrapper, selfie→anatomical labels](detection/README.md) |
| `geometry/` | [Normalization, angles, plane fit](geometry/README.md) |
| `features/` | [The five metrics](features/README.md) |
| `coach/` | [Smoothing, weekly focus, plan, validator](coach/README.md) |
| `progress/` | [Session draft reduction](progress/README.md) |
| `batch/` | [Folder CLI](batch/README.md) |
| `eval/` | [Expert agreement](eval/README.md) |
| `ml/` | [Offline logistic regression](ml/README.md) |

## Who calls it

| Caller | Entry |
|---|---|
| `api/service.py` | `analyze_hands` for photos, frames, and sampled video; `score_detected_hands` for browser landmarks |
| `api/routes/coach.py` | `choose_focus`, `build_plan`, `validate_tip` |
| `api/routes/progress.py` | `build_session_draft` |
| `app.py` | Streamlit photo / video / live |
| `python -m technique_titan.batch.process_folder` | Bulk images |
| `python -m technique_titan.eval` | Agreement report |
| `python -m technique_titan.ml` | Train or compare |

Run module CLIs from the repo `.venv` after `pip install -e .`. Homebrew Python does not have the package on its path.
