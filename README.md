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

Results land in `data/processed/batch_summary.csv` (one row per image with all
vectors, angles, and scores) and `data/processed/outliers.csv` (rows worth a
manual look).

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
