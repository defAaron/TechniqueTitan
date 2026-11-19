# Tests

Python tests for the engine and the API. The web app’s tests are Vitest under `web/` (`npm test`), not this folder.

`pyproject.toml` sets `addopts = "--import-mode=importlib"` and `pythonpath = ["src", "."]`. Importlib is required because `tests/engine/test_coach_plan.py` and `tests/api/test_coach_plan.py` share a basename; pytest’s default importer treats them as one module.

```sh
source .venv/bin/activate
pip install -e ".[api]"
pip install -r requirements-dev.txt
pytest
```

CI uses headless OpenCV. Local Streamlit webcam tests are not part of this suite.

## Layout

| Path | Covers |
|---|---|
| `engine/test_detection.py` | MediaPipe wrapper, when a model can run |
| `engine/test_geometry.py` | Angles and plane fit. Fixtures must be non-collinear |
| `engine/test_features.py` | Five criterion metrics |
| `engine/test_scoring.py` | Piecewise map and bands |
| `engine/test_analysis.py` | Label collision, overlay inputs |
| `engine/test_coaching.py` | Template catalog and daily variant index |
| `engine/test_coach_*.py` | Smoother, focus, plan, validator, drafts, adapter eval |
| `engine/test_progress.py` | Session reduction and the 32 KB cap |
| `engine/test_eval.py` | Hand-aware label join, metrics, split |
| `engine/test_ml.py` | Feature matrix and train/predict on fixtures |
| `api/test_api.py` | Analyze routes, health, upload limits |
| `api/test_rate_limit.py` | Buckets, proxy IP, key cap |
| `api/test_scorer_flag.py` | `SCORER` yaml vs `ml_with_fallback` |
| `api/test_coach_plan.py` | `POST /v1/coach/plan` |
| `api/test_analyze_coach_plan.py` | Plan attached to analyze responses |
| `fixtures/temporal_cases.json` | Shared with `web/src/lib/scoreSmooth.test.ts` |
| `fixtures/coach_validator_cases.json` | Shared with `web/src/lib/coachValidate.test.ts` |
| `fixtures/ml/`, `fixtures/eval/` | Tiny CSVs so CI never needs `data/raw/` |

`tests/conftest.py` adds the repo root and `src/` to `sys.path`.
