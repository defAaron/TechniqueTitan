<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/defAaron/TechniqueTitan">
    <img src="assets/brand/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Technique Titan</h3>

  <p align="center">
    AI piano posture coach that turns a laptop camera into on-demand technique feedback.
    <br />
    <a href="https://github.com/defAaron/TechniqueTitan/blob/main/docs/PRD.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://technique-titan.vercel.app">View Demo</a>
    &middot;
    <a href="https://github.com/defAaron/TechniqueTitan/issues/new">Report Bug</a>
    &middot;
    <a href="https://github.com/defAaron/TechniqueTitan/issues/new">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

[![Product screenshot][product-screenshot]](https://technique-titan.vercel.app)

Technique Titan detects 21 MediaPipe landmarks per hand, scores five geometry-based criteria (0–100), and returns prioritized coaching through a React + FastAPI product — plus Streamlit and a batch CLI for demos and research.

Here's why:

* Students practice far more hours than they spend with a teacher, so collapsed wrists, flat fingers, and tucked thumbs form between lessons.
* Feedback is usually qualitative ("rounder fingers"), which is hard for beginners to internalize or track objectively.
* Self-taught learners and remote students often get no posture feedback at all.
* Manually computing joint angles for every training image does not scale to large datasets.

Technique Titan automates the full pipeline:

1. **Detect** 21 hand landmarks per hand with MediaPipe Hands.
2. **Normalize** coordinates (wrist origin, palm-span scale) so measurements are invariant to camera distance and hand size.
3. **Compute** vectors, joint angles, and per-criterion geometric metrics.
4. **Score** each criterion (0–100) and assign severity bands (good / warning / critical).
5. **Coach** with plain-language tips from YAML templates, prioritized by severity.
6. **Present** results in the web UI, Streamlit, or CSV/JSON for bulk analysis.

Both hands are detected and scored independently when visible in frame.

| Capability | Status |
|---|---|
| Photo upload review | Available (React + Streamlit) |
| Video upload + posture timeline | Available (React + Streamlit) |
| Live camera feedback | Available (React browser MediaPipe; local Streamlit OpenCV) |
| REST analyze API | Available (`api/`) |
| Templated coaching tips | Available (`config/coaching.yaml`) |
| Bulk image processing (CLI) | Available |
| Heuristic vs expert eval (CLI) | Available (`technique_titan.eval`; frozen split; local reports) |
| Offline ML scorer (logistic regression) | Available offline (`technique_titan.ml`); **not** on API — production uses YAML |
| Two-hand detection + separate scores | Available |
| Configurable scoring thresholds | Available (`config/scoring.yaml`; recalibrated 2026-09-19 from train-only notebook) |
| Optional accounts (email / Google) | Available (Supabase Auth; analyze stays public) |
| Progress tracking / session history | Shipped — opt-in save + `/progress` dashboard (scores only; apply Supabase migration) |

### Five posture criteria

| Criterion | What it measures |
|---|---|
| Wrist height | Wrist vs. knuckle line — not collapsed or over-lifted |
| Finger curvature | Natural curve vs. flat or over-clenched fingers |
| Thumb position | Thumb resting on its side vs. tucked or flared out |
| Wrist lateral deviation | Sideways ulnar/radial bend off a straight forearm line |
| Overall hand arch | Dome of the knuckle bridge vs. flat/collapsed hand |

Formulas and landmark inputs are documented in [docs/SCORING_METHODS.md](docs/SCORING_METHODS.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Python][Python]][Python-url]
* [![React][React.js]][React-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![FastAPI][FastAPI]][FastAPI-url]
* [![Vite][Vite]][Vite-url]
* [![Tailwind CSS][Tailwind]][Tailwind-url]
* [![MediaPipe][MediaPipe]][MediaPipe-url]
* [![OpenCV][OpenCV]][OpenCV-url]
* [![Streamlit][Streamlit]][Streamlit-url]

| Layer | Technology |
|---|---|
| Hand detection (server) | MediaPipe Hands `0.10.21` (21 landmarks per hand) |
| Hand detection (browser live) | `@mediapipe/tasks-vision` |
| Image/video I/O | OpenCV `4.10` |
| Math | NumPy `1.26+` (&lt;2) |
| Scoring / coaching config | PyYAML |
| Product API | FastAPI + Uvicorn + Pydantic 2 |
| Product UI | React 19 + TypeScript + Vite 8 + Tailwind 4 |
| Accounts | Supabase Auth (email + Google OAuth) |
| Charts / WebGL | Recharts, OGL |
| Interim UI | Streamlit `1.30+` |
| Deploy | Render (API Docker), Vercel (web), Streamlit Cloud (interim) |
| CI | GitHub Actions (pytest + `npm run build`) |
| Tests | pytest + httpx |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

* **Python 3.11** (MediaPipe `0.10.21` has no wheel for Python 3.13)
* **Node.js 22+** (for the React UI)
* macOS, Windows, or Linux
* Webcam (for live mode)

### Installation

The product stack (React UI + FastAPI) is the recommended local setup.

1. Clone the repo
   ```sh
   git clone https://github.com/defAaron/TechniqueTitan.git
   cd TechniqueTitan
   ```
2. Create a Python 3.11 virtualenv and install the package with API extras
   ```sh
   python3.11 -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -e ".[api]"
   ```
3. Start the API on port 8000
   ```sh
   uvicorn api.main:app --reload --port 8000
   ```
4. Install JS packages and start the React UI
   ```sh
   cd web
   npm install
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173)

Vite proxies `/v1/*` to the API. Missing API on `:8000` produces a Vite **502**.

Optional sign-in (email or Google) needs a dedicated Supabase project. Copy
`web/.env.example` to `web/.env.local` and set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`. Setup: [`supabase/README.md`](supabase/README.md).
Photo, video, and live work without an account.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

### Product UI

| Route | Mode |
|---|---|
| `/photo` | Upload JPEG/PNG → overlay + scores + coaching |
| `/video` | Upload MP4/MOV → frame scores + posture timeline |
| `/live` | Browser camera → landmarks (fast) or frame upload |
| `/about` | How the scoring engine works |
| `/login` | Optional email or Google sign in |
| `/signup` | Create an account |
| `/admin` | Owner-only signup counts |

Live mode on the React UI prefers **browser-side MediaPipe** (`@mediapipe/tasks-vision`) and posts compact landmarks to `POST /v1/score/landmarks` so video stays on-device. Frame-upload mode (`POST /v1/analyze/frame`) is available as a fallback.

### Streamlit UI (interim / research)

```sh
pip install -e .
# Live camera needs the full OpenCV build (not headless):
pip uninstall opencv-python-headless -y 2>/dev/null
pip install opencv-python==4.10.0.84

streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501). Sidebar modes: Photo, Video, Live camera.

On macOS, grant camera access under **System Settings → Privacy & Security → Camera** for Cursor or Terminal before using live mode.

### Batch processing (testers / datasets)

Use the repo `.venv`, not Homebrew `python3.11` (that interpreter does not have the package):

```sh
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e .
# For tests / eval extras: pip install -r requirements-dev.txt
```

Drop images into `data/raw/` (subfolders OK; e.g. `excellent/1.png`, `good/2.png`), then:

```sh
python -m technique_titan.batch.process_folder \
  --input data/raw \
  --output data/processed \
  --labels data/labels.csv   # optional — export from Notion labeling table
```

**Expert labels** are maintained in the **Notion** page `techniquetitan` (classification table). Agents with Notion MCP can read/update that table to complete labeling; export to `data/labels.csv` when running batch scoring. See [data/README.md](data/README.md) and [AGENTS.md](AGENTS.md).

Outputs:

- `data/processed/batch_summary.csv` — one row per detected hand
- `data/processed/metrics/` — full vectors, angles, and scores per image
- `data/processed/outliers.csv` — auto-flagged suspicious rows

### Evaluation loop

After a labeled batch run, compare predicted severities to expert labels. Same `.venv` as batch (`source .venv/bin/activate`). The eval CLI merges summary + `data/labels.csv` (hand-aware: `left`/`right` vs `both`; the batch CSV still merges labels by filename only), then reports per-criterion accuracy, Cohen’s κ, and confusion matrices on the frozen split:

```sh
python -m technique_titan.eval \
  --summary data/processed/batch_summary.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --output data/eval/reports
```

`data/eval/holdout_split.json` is tracked. Generated files under `data/eval/reports/` are gitignored. Threshold search is `notebooks/scoring_tuning.ipynb`: fit candidate `ideal`/`limit` bands on TRAIN only; copy into `config/scoring.yaml` only if HOLD-OUT agreement rises. The notebook does not overwrite YAML.

**NFR-ACC-2** target is ≥85% expert severity agreement. Measured **heuristic hold-out macro accuracy is 0.689** (Cohen's κ 0.103) after the 2026-09-19 YAML promotion — **below target**. Re-run after every Notion export and batch. Details: [`docs/ML_UPGRADE.md`](docs/ML_UPGRADE.md), [`docs/ROADMAP.md`](docs/ROADMAP.md).

Full agreement reports need local `data/raw/` → `data/processed/` (raw images are gitignored). CI runs eval/ML **unit tests** via pytest, not a MediaPipe batch on `data/raw`.

Offline classical ML (one multinomial logistic regression per criterion) uses `data/labels.csv` plus `data/processed/batch_summary.csv` and/or `data/synthetic/feature_rows.csv`. **Production API scoring stays YAML-only** until ML meets or beats heuristic hold-out on real images. Math: [`docs/ML_LOGISTIC_REGRESSION.md`](docs/ML_LOGISTIC_REGRESSION.md).

```sh
source .venv/bin/activate   # or prefix commands with .venv/bin/python -m
pip install -e ".[ml]"

python -m technique_titan.ml.synthetic \
  --labels data/labels.csv \
  --output data/synthetic/feature_rows.csv

python -m technique_titan.ml.train \
  --labels data/labels.csv \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --split data/eval/holdout_split.json \
  --output config/models

python -m technique_titan.eval --scorer compare \
  --summary data/processed/batch_summary.csv \
  --synthetic data/synthetic/feature_rows.csv \
  --labels data/labels.csv \
  --split data/eval/holdout_split.json \
  --models config/models \
  --output data/eval/reports
```

### How it works

```mermaid
graph TD
    Photo["Photo upload"] --> Detect["MediaPipe hand detection"]
    Video["Video upload"] --> Detect
    LiveCam["Live camera"] --> Detect
    Batch["Batch folder"] --> Detect
    Detect --> Norm["Normalize landmarks"]
    Norm --> Features["Extract vectors and angles"]
    Features --> Score["Score 5 criteria"]
    Score --> Coach["Templated coaching"]
    Coach --> Overlay["Annotated skeleton overlay"]
    Coach --> Panel["Per-hand scores and tips"]
    Score --> CSV["batch_summary.csv"]
    Score --> JSON["Per-image metrics JSON"]
```

For each detected hand the pipeline:

1. Picks world landmarks when available (more stable 3D angles), otherwise image coordinates.
2. Resolves left/right labels; disambiguates collisions by wrist position when MediaPipe reports the same handedness for both hands.
3. Computes raw geometry for all five criteria, then maps metrics to scores using thresholds in `config/scoring.yaml`.
4. Generates prioritized coaching tips from `config/coaching.yaml`.
5. Colors the skeleton overlay by worst severity (green / orange / red) and tags each hand with `L` or `R`.

### Architecture

Product serving, shared engine, and offline research as one graph. Every arrow is a real call or data dependency.

```mermaid
graph TD
    Cam["Laptop camera"] --> LivePage["React Live"]
    PhotoFile["Photo file"] --> PhotoPage["React Photo"]
    VideoFile["Video file"] --> VideoPage["React Video"]
    LivePage --> ReactUI["React UI on Vercel"]
    PhotoPage --> ReactUI
    VideoPage --> ReactUI
    AuthPage["Login and signup"] --> ReactUI
    AdminPage["Admin stats"] --> ReactUI
    ReactUI --> Supabase["Supabase Auth"]
    AdminPage --> Supabase
    AuthPage --> Supabase
    LivePage --> BrowserMP["Browser MediaPipe"]
    PhotoPage -->|"POST /v1/analyze/image"| FastAPI["FastAPI on Render"]
    VideoPage -->|"POST /v1/analyze/video"| FastAPI
    LivePage -->|"POST /v1/analyze/frame"| FastAPI
    BrowserMP -->|"POST /v1/score/landmarks"| FastAPI
    FastAPI --> Health["GET /v1/health"]
    FastAPI --> PubCfg["GET /v1/config/public"]
    FastAPI --> ServerMP["HandDetector MediaPipe 0.10.21"]
    FastAPI --> Analysis["analysis.py"]
    BrowserMP --> Analysis
    Streamlit["Streamlit app.py"] --> ServerMP
    Streamlit --> Analysis
    RawDir["data/raw photos"] --> BatchCLI["batch process_folder"]
    BatchCLI --> ServerMP
    ServerMP --> Analysis
    Analysis --> Geometry["geometry normalize"]
    Geometry --> Features["features extract"]
    Features --> WristH["Wrist height"]
    Features --> FingerC["Finger curvature"]
    Features --> ThumbP["Thumb position"]
    Features --> WristL["Wrist lateral"]
    Features --> HandA["Hand arch"]
    WristH --> Scoring["scoring.py"]
    FingerC --> Scoring
    ThumbP --> Scoring
    WristL --> Scoring
    HandA --> Scoring
    ScoringYaml["config/scoring.yaml"] --> Scoring
    Scoring --> Coaching["coaching.py"]
    CoachingYaml["config/coaching.yaml"] --> Coaching
    Coaching --> Overlay["Skeleton overlay"]
    Coaching --> Panel["Score panel and tips"]
    Overlay --> ReactUI
    Panel --> ReactUI
    Overlay --> Streamlit
    Panel --> Streamlit
    Scoring --> CsvOut["batch_summary.csv"]
    Scoring --> JsonOut["per-image metrics JSON"]
    BatchCLI --> CsvOut
    BatchCLI --> JsonOut
    Notion["Notion labels"] --> LabelsCsv["data/labels.csv"]
    LabelsCsv --> BatchCLI
    CsvOut --> EvalCLI["eval CLI"]
    LabelsCsv --> EvalCLI
    Holdout["holdout_split.json"] --> EvalCLI
    EvalCLI --> Reports["eval reports"]
    EvalCLI --> Notebook["scoring_tuning.ipynb"]
    Notebook --> ScoringYaml
    CsvOut --> MlTrain["ml train"]
    LabelsCsv --> MlTrain
    Synthetic["synthetic feature_rows.csv"] --> MlTrain
    MlTrain --> Models["config/models offline"]
    Models --> EvalCLI
    GHA["GitHub Actions"] --> TestEngine["pytest engine"]
    GHA --> TestApi["pytest API"]
    GHA --> WebBuild["npm run build"]
    TestEngine --> Analysis
    TestEngine --> Scoring
    TestApi --> FastAPI
    WebBuild --> ReactUI
    classDef product fill:#e8f1ff,stroke:#1d4ed8,color:#111111
    classDef research fill:#f3e8ff,stroke:#6d28d9,color:#111111
    classDef core fill:#f4f4f5,stroke:#18181b,color:#111111
    class Cam,PhotoFile,VideoFile,LivePage,PhotoPage,VideoPage,AuthPage,AdminPage,ReactUI,Streamlit,BrowserMP,FastAPI,Health,PubCfg,ServerMP product
    class RawDir,BatchCLI,Notion,LabelsCsv,CsvOut,JsonOut,Holdout,EvalCLI,Reports,Notebook,MlTrain,Synthetic,Models research
    class Analysis,Geometry,Features,WristH,FingerC,ThumbP,WristL,HandA,Scoring,Coaching,Overlay,Panel,ScoringYaml,CoachingYaml,GHA,TestEngine,TestApi,WebBuild,Supabase core
```

Blue is product serving, purple is offline research, gray is the shared engine, config, and CI.

Repo layout:

```
technique_titan/
├── api/                      # FastAPI product backend (uvicorn api.main:app)
├── web/                      # React + TypeScript + Tailwind product UI (Vercel root)
│   ├── public/landing/       # Optimized landing stills + clips
│   └── src/
│       ├── components/
│       │   ├── layout/       # chrome (Layout, CinematicChrome, ApiStatusBanner)
│       │   ├── marketing/    # landing (CinematicHero)
│       │   ├── analyze/      # results (ScorePanel, CoachingTips, OverlayImage)
│       │   └── ui/           # primitives (Reveal, SpecularButton)
│       ├── pages/
│       └── lib/
├── src/technique_titan/      # Core library (detect → features → score → coach)
│   ├── detection/
│   ├── geometry/
│   ├── features/
│   ├── batch/                # Bulk folder processor CLI
│   ├── eval/                 # Heuristic vs expert agreement (CLI)
│   ├── ml/                   # Offline logistic scoring (train / predict)
│   ├── analysis.py
│   ├── scoring.py
│   └── coaching.py
├── assets/
│   ├── brand/                # Master brand icon (favicons derived in web/public)
│   └── source/               # Unoptimized masters (gitignored)
├── config/                   # scoring.yaml + coaching.yaml (+ gitignored models/)
├── data/
│   ├── raw/                  # Labeled set: excellent|good|warning|critical
│   ├── fixtures/             # Local smoke images (not labeled)
│   ├── processed/            # Batch outputs (gitignored)
│   ├── synthetic/            # Companion feature table for f-prefixed labels
│   └── eval/                 # holdout_split.json (tracked) + reports/ (gitignored)
├── docs/
│   ├── archive/              # Research notes / historical artifacts
│   ├── PRD.md
│   ├── ROADMAP.md
│   ├── ML_UPGRADE.md
│   ├── ML_LOGISTIC_REGRESSION.md
│   ├── SCORING_METHODS.md
│   ├── DEPLOY.md
│   └── errors.md
├── supabase/                 # Auth schema, bootstrap SQL, migrations
├── tests/
│   ├── engine/               # Core library unit tests
│   └── api/                  # FastAPI tests
├── notebooks/                # scoring_tuning.ipynb (TRAIN search; HOLD-OUT gate)
├── .github/workflows/        # pytest + web build
├── AGENTS.md                 # Agent operating instructions
├── app.py                    # Streamlit UI (interim / Cloud demo) — keep at repo root
├── Dockerfile                # API image (Render) — keep at repo root
├── render.yaml               # Render Blueprint (optional)
├── packages.txt              # Streamlit Cloud apt packages
├── pyproject.toml
├── requirements.txt          # Streamlit Cloud
├── requirements-api.txt      # Docker / API
└── requirements-dev.txt      # Local tests
```

| Module | Role |
|---|---|
| `detection/hand_detector.py` | Wraps MediaPipe; returns landmarks, handedness, confidence |
| `geometry/vectors.py` | Joint angles, normalization, plane fitting |
| `features/*.py` | Per-criterion raw metric extractors |
| `scoring.py` | Piecewise-linear score mapping from `config/scoring.yaml` |
| `coaching.py` | Templated tips from `config/coaching.yaml` |
| `analysis.py` | `analyze_hands()`, overlay drawing, label disambiguation |
| `batch/process_folder.py` | Walks `data/raw/`, writes CSV/JSON exports |
| `eval/` | Merges batch summary + labels; accuracy, Cohen’s κ, confusion matrices vs frozen split |
| `ml/` | Offline per-criterion logistic regression (train CLI, joblib artifacts) |

### API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/analyze/image` | Photo analysis (max 8 MB) |
| `POST` | `/v1/analyze/frame` | Live JPEG frame (max 8 MB) |
| `POST` | `/v1/analyze/video` | Video analysis (max 40 MB) |
| `POST` | `/v1/score/landmarks` | Score browser-extracted landmarks |
| `GET` | `/v1/health` | Healthcheck |
| `GET` | `/v1/config/public` | Public criterion labels + modes |

OpenAPI docs: `http://127.0.0.1:8000/docs` when the API is running.

### Deployment

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for Render + Vercel + Streamlit Cloud.

| Surface | Host |
|---|---|
| Product UI (`web/`) | [Vercel](https://technique-titan.vercel.app) |
| Product API (`api/`) | [Render](https://technique-titan-api.onrender.com) (Docker) |
| Interim demo (`app.py`) | Streamlit Community Cloud |

Live camera does **not** work on Streamlit Cloud (no webcam on the server). Use the React **Live** page for hosted real-time feedback.

### Development

```sh
# Python tests (from the repo .venv)
source .venv/bin/activate
pip install -e ".[api]"
pip install -r requirements-dev.txt
pytest

# Web
cd web && npm ci && npm run lint && npm run build

# Batch smoke test
python -m technique_titan.batch.process_folder \
  --input data/raw --output data/processed
```

Project conventions:

* Scoring thresholds live in `config/scoring.yaml` — tune without code changes.
* Coaching copy lives in `config/coaching.yaml` — templates, not an LLM.
* The batch CLI is for bulk data; eval compares that output to expert labels; the React UI is for interactive review.
* Prefer Python **3.11** in all environments (CI, Docker, Streamlit Cloud).

### Documentation

| Document | Description |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements and personas |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased delivery plan |
| [docs/ML_UPGRADE.md](docs/ML_UPGRADE.md) | AI/ML upgrade path (eval → learned scoring → temporal → vision) |
| [docs/ML_LOGISTIC_REGRESSION.md](docs/ML_LOGISTIC_REGRESSION.md) | Offline logistic scorer — features, math, train/compare CLI |
| [docs/SCORING_METHODS.md](docs/SCORING_METHODS.md) | Formulas and landmark inputs per criterion |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Render + Vercel + Streamlit Cloud deploy guide |
| [supabase/README.md](supabase/README.md) | Dedicated Auth project, Google OAuth, admin stats |
| [docs/errors.md](docs/errors.md) | Chronological error history — agents must check before new work |
| [web/README.md](web/README.md) | React UI develop / build notes |
| [data/README.md](data/README.md) | Dataset intake, labels export, batch + eval |

_For more examples, please refer to the [Documentation](docs/PRD.md)._

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap

- [x] Phase 0 — Foundation: project structure, tests, data strategy
- [x] Phase 1 — Core engine + eval harness (hold-out macro **0.689** vs ≥85% target — validation ongoing)
- [x] Phase 2 — Feedback engine: templated coaching + overlays
- [x] Phase 3a — Product surface: React UI + API (photo / video / live)
- [x] Phase 3b (accounts) — Optional email / Google sign-in + owner signup stats
- [x] Phase 3b — Session persistence + progress dashboard (Supabase free-tier caps; no media)
- [ ] Phase 3b — Capture guidance, accessibility (WCAG basics)
- [ ] Phase 4 — Intelligence (in progress offline)
  - [x] Eval loop + YAML calibration gate + offline logistic regression ([docs/ML_UPGRADE.md](docs/ML_UPGRADE.md))
  - [ ] Production ML + ≥85% hold-out agreement
  - [ ] Viewpoint gate, temporal habits, piano-specific perception
  - [ ] Teacher / student roles + exportable reports
- [ ] Phase 5 — Scale & polish: performance, full a11y audit, monetization, observability

See [docs/ROADMAP.md](docs/ROADMAP.md) for full detail, and the [open issues](https://github.com/defAaron/TechniqueTitan/issues) for proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

No license file is specified yet. Contact the repository owner for usage terms.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Aaron — [defAaron](https://github.com/defAaron)

Project Link: [https://github.com/defAaron/TechniqueTitan](https://github.com/defAaron/TechniqueTitan)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [MediaPipe Hands](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
* [OpenCV](https://opencv.org/)
* [FastAPI](https://fastapi.tiangolo.com/)
* [React](https://react.dev/)
* [Streamlit](https://streamlit.io/)
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
* [Img Shields](https://shields.io)
* [Choose an Open Source License](https://choosealicense.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[product-screenshot]: web/public/landing/pianist.jpg
[Python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
[Python-url]: https://www.python.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[FastAPI]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
[FastAPI-url]: https://fastapi.tiangolo.com/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vite.dev/
[Tailwind]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[MediaPipe]: https://img.shields.io/badge/MediaPipe-009688?style=for-the-badge&logo=google&logoColor=white
[MediaPipe-url]: https://ai.google.dev/edge/mediapipe
[OpenCV]: https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white
[OpenCV-url]: https://opencv.org/
[Streamlit]: https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white
[Streamlit-url]: https://streamlit.io/
