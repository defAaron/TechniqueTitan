# Scoring Methods

Documents each criterion's landmark inputs and formula (PRD FR-SC-6). All
measurements are computed on **normalized landmarks**: translated so the wrist
(landmark 0) is the origin, and scaled so the palm span (distance from index
MCP 5 to pinky MCP 17) equals 1. This makes every metric invariant to camera
distance and hand size (PRD FR-PD-4). When MediaPipe world landmarks are
available they are preferred over image coordinates for more stable 3D angles.

Scores are mapped from raw metrics via `config/scoring.yaml`: each criterion
has an `ideal` range (scores 100) and a `limit` range (scores 0 at its edges),
with linear falloff in between. Severity bands: score >= 80 is **good**,
\>= 50 is **warning**, below is **critical** (all configurable).

## Landmark index reference

MediaPipe's 21 hand landmarks: 0 = wrist; 1–4 = thumb (CMC, MCP, IP, TIP);
5–8 = index (MCP, PIP, DIP, TIP); 9–12 = middle; 13–16 = ring; 17–20 = pinky.

## 1. Wrist height (`wrist_height_delta`)

- **Inputs:** wrist (0), MCPs (5, 9, 13, 17)
- **Formula:** mean the four MCP positions; `delta = -mean_mcp_y` in
  normalized coordinates (image y grows downward, so the negation gives a
  y-up reading).
- **Interpretation:** ~0 means the wrist is level with the knuckles. Strongly
  positive means the knuckles sit far above the wrist (collapsed/dropped
  wrist); negative means the wrist is lifted above the knuckle line.
- **Also exported:** `wrist_knuckle_tilt` — angle between the wrist-to-knuckle
  vector and the palm width axis.

## 2. Finger curvature (`mean_finger_curvature`)

- **Inputs:** the four long-finger chains MCP→PIP→DIP→TIP
- **Formula:** interior joint angle at each PIP and each DIP (8 angles). The
  angle at joint B between segments B→A and B→C is
  `arccos(BA · BC / |BA||BC|)`.
- **Interpretation:** a dead-straight (flat) finger reads 180° per joint; a
  healthy "holding a bubble" curve sits roughly 115–160°; an over-clenched
  fist reads much lower.
- **Also exported:** all 8 individual angles (`index_pip`, `index_dip`, ...).

## 3. Thumb position (`thumb_index_angle`, `thumb_lateral_offset`)

- **Inputs:** thumb CMC (1), MCP (2), TIP (4); index MCP (5), TIP (8);
  wrist (0), pinky MCP (17)
- **Formulas:**
  - `thumb_mcp_abduction` — interior angle at the thumb MCP between the CMC
    and the tip. Very small = tucked/clenched thumb.
  - `thumb_index_angle` — angle between the thumb axis (MCP→TIP) and the
    index axis (MCP→TIP). Near 0° = thumb glued under the hand; very large =
    thumb flaring out sideways. This is the scored metric.
  - `thumb_lateral_offset` — absolute distance of the thumb tip from the palm
    plane (best-fit plane through wrist, index MCP, pinky MCP), in palm-span
    units.

## 4. Wrist lateral deviation (`wrist_lateral_deviation_deg`)

- **Inputs:** wrist (0), middle MCP (9), index MCP (5), pinky MCP (17)
- **Formula:** hand axis = wrist→middle MCP (forearm-to-hand proxy); palm
  width axis = index MCP→pinky MCP. On a straight wrist these are roughly
  perpendicular, so `deviation = angle_between(axes) - 90°`. The sign is
  flipped for left hands so that positive always means **ulnar** deviation
  (bending toward the pinky side).
- **Interpretation:** |deviation| within ~10° is neutral; beyond ~35° in
  either direction is scored 0.

## 5. Overall hand arch (`hand_arch_ratio`)

- **Inputs:** wrist (0), MCPs (5, 9, 13, 17)
- **Formulas:**
  - `knuckle_bridge` — interior angle at the middle MCP between index and
    ring MCPs. A flat knuckle line reads ~180°; a domed bridge reads lower.
  - `mcp_dome_spread` — standard deviation of the four MCPs' signed distances
    from their own best-fit plane.
  - `hand_arch_ratio` (scored) — the larger of the middle/ring MCP elevations
    above the palm base plane (best-fit plane through wrist, index MCP,
    pinky MCP), in palm-span units. Near 0 = flat or collapsed hand; higher
    values indicate a pronounced dome.

## Composite score

Weighted mean of the five criterion scores. Default weights (configurable in
`config/scoring.yaml`): wrist height 0.25, finger curvature 0.25, hand arch
0.20, thumb position 0.15, wrist lateral deviation 0.15. Criteria whose metric
is missing are excluded and the remaining weights are renormalized.

## Known viewpoint caveats

Several metrics are camera-angle sensitive (PRD Open Question 1):

- Wrist height reads best from a **side view**; from directly overhead the
  vertical delta compresses toward 0.
- Hand arch and thumb lateral offset depend on the z coordinate, which is more
  reliable from world landmarks than image-normalized coordinates.
- Batch runs flag statistically extreme values in `outliers.csv` so
  angle-related artifacts can be reviewed instead of silently skewing data.
