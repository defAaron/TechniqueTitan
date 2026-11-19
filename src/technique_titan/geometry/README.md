# Geometry

Coordinate frame and angle primitives for every criterion. No scoring and no YAML here.

## Landmarks

`landmarks.py` names MediaPipe’s 21 indices so formulas do not use raw integers.

| Index | Name |
|---|---|
| 0 | Wrist |
| 1–4 | Thumb CMC, MCP, IP, tip |
| 5–8 | Index MCP, PIP, DIP, tip |
| 9–12 | Middle |
| 13–16 | Ring |
| 17–20 | Pinky |

`FINGER_CHAINS` is MCP → PIP → DIP → tip for the four long fingers. `ALL_MCPS` is index, middle, ring, pinky.

## Normalization

`vectors.normalize_landmarks` translates so landmark 0 is the origin, then divides by the distance from index MCP (5) to pinky MCP (17). After that, palm span is 1. Scores do not grow just because the player leaned toward the camera or has a larger hand.

The same functions accept image-normalized points or world-landmark meters. `analysis._score_hand` passes world landmarks when they exist.

## Primitives

| Function | Result |
|---|---|
| `vector`, `distance` | Segment between two points |
| `angle_between` | 0–180° between two vectors. Zero-length vectors return NaN. |
| `angle_at_joint(a, b, c)` | Interior angle at `b`. A straight finger is ~180°. |
| `fit_plane` | Best-fit plane through a point set (SVD). Used for thumb offset from the palm. |

Plane fits need a non-collinear set. The thumb metric uses wrist + index MCP + pinky MCP. Tests that build a synthetic triangle have to do the same; collinear MCP points make the normal indeterminate (`docs/errors.md` E05).

## Tests

`tests/engine/test_geometry.py`.
