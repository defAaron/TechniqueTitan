# Technique Titan

AI-powered piano hand posture analysis from images and video. Detects hand
landmarks, computes geometric features for five posture criteria, and exports
structured scores and feedback.

## Project structure

```
technique_titan/
├── config/              # Scoring thresholds and weights (YAML)
├── data/
│   ├── raw/             # Drop test images here
│   └── processed/       # Generated batch outputs (gitignored)
├── docs/                # PRD, roadmap, scoring formulas, research notes
├── legacy/              # Archived originals (pre-restructure)
├── scripts/             # Runnable demos and early prototypes
├── src/technique_titan/ # Core library (detection, geometry, scoring, batch)
└── tests/               # Unit tests
```

## Quick start

```bash
# 1. Create and activate a virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# 2. Install the package
pip install -e .

# 3. Drop hand images into data/raw/ (subfolders OK)

# 4. Run the batch processor
python -m technique_titan.batch.process_folder \
  --input data/raw --output data/processed
```

Both hands are detected and scored independently. Results land in
`data/processed/batch_summary.csv` (one row **per detected hand**, keyed by
`source` + `hand` + `hand_index`, with all vectors, angles, and scores) and
`data/processed/outliers.csv` (rows worth a manual look).

## Run the UI

A simple Streamlit app for interactive, one-at-a-time review:

```bash
pip install -e .        # installs streamlit and the package
streamlit run app.py
```

The sidebar offers three modes, each showing an annotated landmark overlay plus
a five-criterion score panel. When two hands are visible, both are drawn (tagged
`L`/`R`) and each gets its own score panel:

1. **Photo** - upload a single image for review.
2. **Video** - upload a clip to build a per-hand posture timeline over its frames.
3. **Live camera** - real-time feedback from your default camera (grant camera
   permission to the terminal or app running Streamlit).

The batch CLI above remains the tool for bulk data; the UI is for reviewing one
input at a time.

## Deploy (Streamlit Community Cloud)

The app is deployable to [Streamlit Community Cloud](https://streamlit.io/cloud)
from this GitHub repo:

1. Push `main` to `https://github.com/defAaron/TechniqueTitan`
2. Sign in at [share.streamlit.io](https://share.streamlit.io) with GitHub
3. **New app** → pick `defAaron/TechniqueTitan`, branch `main`, main file `app.py`
4. Deploy — Streamlit installs deps from [`requirements.txt`](requirements.txt)

Or from a local checkout (requires a Streamlit Cloud account):

```bash
pip install streamlit
streamlit deploy app.py --title "Technique Titan"
```

**Cloud notes:** Photo and video upload work on Streamlit Cloud. **Live camera**
requires a local webcam and only works when you run `streamlit run app.py` on
your machine, not on the hosted server.

## Documentation

- [Product requirements](docs/PRD.md)
- [Roadmap](docs/ROADMAP.md)
- [Scoring formulas](docs/SCORING_METHODS.md)
- [Data intake guide](data/README.md)

## Scripts

- `scripts/live_webcam_demo.py` — original webcam landmark overlay demo
- `scripts/hand_detector_prototype.py` — early `handDetector` class prototype

The production detection module lives at
`src/technique_titan/detection/hand_detector.py`.
