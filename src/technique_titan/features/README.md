# Features

One module per posture criterion, plus `extract.py` which runs all five on a single hand.

`extract_all_features(landmarks_21x3, handedness)` normalizes first, then returns:

- `vectors` — named segments the metrics used
- `angles_deg` — joint angles, also the numeric columns the offline trainer reads
- `criterion_metrics` — the scalars `scoring.score_all` looks up by the `metric` key in `config/scoring.yaml`

Handedness is required because wrist lateral deviation flips sign on the left hand.

## The five metrics

Full landmark write-up: [`docs/SCORING_METHODS.md`](../../../../docs/SCORING_METHODS.md).

| Module | Scored key | Idea |
|---|---|---|
| `wrist_height.py` | `wrist_height_delta` | Mean of the four MCP y-coordinates, negated so up is positive. ~0 is level with the knuckles. Large positive is a dropped wrist. Also exports `wrist_knuckle_tilt`. |
| `finger_curvature.py` | `mean_finger_curvature` | Mean of eight interior angles (PIP and DIP on four fingers). ~180° is flat. A rounded hand sits lower. Also exports `index_pip`, `index_dip`, and the same for middle, ring, pinky. |
| `thumb_position.py` | `thumb_index_angle` | Angle between thumb axis (MCP→tip) and index axis (MCP→tip). Near 0° is tucked; a very large angle is flared. Also exports `thumb_mcp_abduction` and `thumb_lateral_offset` (tip distance from the palm plane, in palm-span units). |
| `wrist_lateral.py` | `wrist_lateral_deviation_deg` | Hand axis (wrist→middle MCP) vs palm-width axis (index MCP→pinky MCP), minus 90°. Sign is flipped for left hands so positive means ulnar (toward the pinky) on both sides. |
| `hand_arch.py` | `hand_arch_ratio` | Peak MCP height above the best-fit palm plane, in palm-span units. A collapsed hand sits near 0. Also exports `knuckle_bridge` (interior angle at the middle MCP) and `mcp_dome_spread`. |

Each `compute()` returns `{vectors, angles_deg, metrics}`. `extract.py` merges those dicts. Criterion names on the metrics dict are not the YAML criterion ids; the YAML `metric:` field is the join key (`wrist_height_delta`, not `wrist_height`).

## Tests

`tests/engine/test_features.py`.
