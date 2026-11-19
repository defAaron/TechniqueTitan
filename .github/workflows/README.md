# CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests. `permissions: contents: read`.

Two jobs:

| Job | What it proves |
|---|---|
| `python` | Python 3.11, `pip install -e ".[api]"`, `requirements-dev.txt`, then swap to `opencv-python-headless==4.10.0.84` plus `libgl1`. `pytest -q`. |
| `web` | Node 22, `npm ci` in `web/`, `npm run build` (`tsc` and Vite). |

The workflow does not batch-score `data/raw/`, does not train models, and does not call Render, Vercel, Supabase, or Hugging Face. Eval and ML are covered by fixture tests under `tests/`.

Headless OpenCV in CI is intentional. The local Streamlit webcam needs the full `opencv-python` wheel instead, and those two wheels must not be resolved together.
