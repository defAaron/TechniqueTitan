# Problem 4 — Agent A: coaching catalog variants

You own **only** `config/coaching.yaml`. Do not edit Python, tests, or docs. Do not commit. Do not invent a hash function.

## Requirement

Each `(criterion, severity, direction)` cell under `criteria` already has `problem` and `fix`. Add a `variants` list of **exactly 4** `{problem, fix}` objects on every warning and critical × `too_low` / `too_high` / `generic` cell.

- Keep the existing `problem` and `fix` keys. Do not delete or reword them.
- `variants[0].problem` and `variants[0].fix` are **character-for-character** the sentences already in that cell.
- Write three more pairs (`variants[1]` through `variants[3]`) that keep the same meaning and pass the validator below.
- Leave `encouragement` unchanged.
- 5 criteria × 2 severities × 3 directions = **30 cells**.

## Validator (every variant, including variants[0])

`validate_tip` is applied to the string `"{problem} {fix}"` (one space) with `tip_kind: live` (cap **220 characters**).

Pass only if all of these hold for that combined string:

1. Non-empty. One sentence in `problem`, one sentence in `fix`, so the pair is exactly two sentences. End each sentence with a period.
2. Combined length ≤ 220.
3. At least one allow-word for the criterion (case-insensitive substring):
   - `wrist_height`: wrist, knuckle
   - `finger_curvature`: finger, curve, round
   - `thumb_position`: thumb
   - `wrist_lateral`: wrist, side
   - `hand_arch`: arch, knuckle, palm
4. Does **not** contain these substrings: `diagnos`, `injur`, `doctor`, `medical`, `pain`, `surgery`, `arthritis`. (`pain` is a substring, so do not write "paint".)
5. No digits.
6. No markdown characters `# * \`` or `[` `]`. No emoji.
7. Plain sentences. No HTML.

Direction guards in `config/coach_direction_guards.yaml` are empty. Still do not swap the physical correction:

| Cell | Meaning to keep |
|---|---|
| wrist_height too_low | Wrist is raised above the knuckles. Ease it down until level. |
| wrist_height too_high | Wrist has dropped below the knuckles. Bring it up until level. |
| wrist_height generic | Wrist height is off. Aim for level with the knuckles. |
| finger_curvature too_low | Fingers curl too tightly. Soften into a round shape. |
| finger_curvature too_high | Fingers are too flat. Round them. |
| finger_curvature generic | Finger curve needs a reset toward a soft round shape. |
| thumb_position too_low | Thumb is tucked in. Ease it out onto its side. |
| thumb_position too_high | Thumb flares wide. Draw it in onto its side. |
| thumb_position generic | Thumb is off. Rest it on its side, not tucked or flared. |
| wrist_lateral too_low | Wrist bends toward the thumb side. Straighten over the forearm. |
| wrist_lateral too_high | Wrist bends toward the pinky side. Straighten over the forearm. |
| wrist_lateral generic | Wrist is angled sideways. Align with the forearm. |
| hand_arch too_low | Knuckle arch is flat. Lift a gentle dome. |
| hand_arch too_high | Arch is too high and stiff. Soften the dome. |
| hand_arch generic | Arch needs a small reset to a gentle dome. |

Warning copy stays mild ("a little"). Critical copy stays stronger than its warning twin. The three new pairs must not be identical to each other or to variants[0].

## Done

`load_coaching_config()` still loads the file. Report status DONE, the cell count, and any sentence you are unsure will pass the length cap.
