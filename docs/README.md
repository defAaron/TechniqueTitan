# Docs

Long-form writing about Technique Titan. Code-level behavior lives in the folder READMEs linked from the [root README](../README.md). When a design doc and the code disagree, the code and the folder README are the current behavior.

## Viewer docs

| Doc | What it is |
|---|---|
| [PRD.md](PRD.md) | Product requirements, personas, and the accuracy bar (NFR-ACC-2 ≥ 85% expert agreement). |
| [ROADMAP.md](ROADMAP.md) | Phased delivery. The baseline table at the top is the status snapshot. |
| [SCORING_METHODS.md](SCORING_METHODS.md) | Landmark indices and the formula for each of the five criteria. |
| [DEPLOY.md](DEPLOY.md) | Vercel (web), Render (API Docker), Streamlit Cloud (interim). |
| [ML_UPGRADE.md](ML_UPGRADE.md) | Why a learned scorer has to beat YAML on the frozen hold-out before it ships. |
| [ML_LOGISTIC_REGRESSION.md](ML_LOGISTIC_REGRESSION.md) | Feature columns, multinomial logistic regression, train and compare CLIs. |
| [PERSONALIZED_COACH.md](PERSONALIZED_COACH.md) | Design contract for weekly focus, smoothing, the validator, and the on-device wording model. |
| [errors.md](errors.md) | Chronological failure log. Agents read the checklist before changing the stack. |
| [report/](report/README.md) | Overleaf/LaTeX write-up of the project. |

## Folder READMEs (implementation)

| Folder | Aspect |
|---|---|
| [web/](../web/README.md) | Product UI |
| [web/src/pages/](../web/src/pages/README.md) | Routes and what each screen does |
| [web/src/lib/](../web/src/lib/README.md) | API client, MediaPipe, smoothing, auth, progress |
| [web/src/components/](../web/src/components/README.md) | Layout, analyze panels, marketing, progress widgets |
| [web/src/workers/](../web/src/workers/README.md) | WebGPU wording worker |
| [api/](../api/README.md) | FastAPI |
| [src/technique_titan/](../src/technique_titan/README.md) | Shared engine |
| [detection/](../src/technique_titan/detection/README.md) | MediaPipe wrapper and laterality |
| [geometry/](../src/technique_titan/geometry/README.md) | Normalization, angles, plane fit |
| [features/](../src/technique_titan/features/README.md) | Five criterion metrics |
| [coach/](../src/technique_titan/coach/README.md) | Plan, focus, dwell, validator |
| [progress/](../src/technique_titan/progress/README.md) | Session reduction |
| [batch/](../src/technique_titan/batch/README.md) | Folder scoring CLI |
| [eval/](../src/technique_titan/eval/README.md) | Hold-out agreement |
| [ml/](../src/technique_titan/ml/README.md) | Offline logistic scorer |
| [config/](../config/README.md) | YAML thresholds, tips, direction guards |
| [data/](../data/README.md) | Labels, raw layout, synthetic rows |
| [data/coach/](../data/coach/README.md) | Wording training text |
| [data/eval/](../data/eval/README.md) | Frozen split |
| [data/synthetic/](../data/synthetic/README.md) | Companion feature table |
| [supabase/](../supabase/README.md) | Auth, progress tables, RLS |
| [tests/](../tests/README.md) | Pytest layout |
| [notebooks/](../notebooks/README.md) | Threshold search |
| [assets/](../assets/README.md) | Brand and landing masters |

## Numbers that show up everywhere

- Five criteria, fixed order: `wrist_height`, `finger_curvature`, `thumb_position`, `wrist_lateral`, `hand_arch`.
- Severity: score ≥ 80 good, ≥ 50 warning, else critical.
- Hold-out macro accuracy after the 2026-09-19 YAML promotion: **0.689** (κ 0.103) on 10 frozen real-image ids. Target ≥ 0.85.
- Production scorer: YAML. `SCORER=ml_with_fallback` is optional and off by default.
- Python 3.11, MediaPipe `0.10.21`, NumPy `< 2`, OpenCV ~4.10.
