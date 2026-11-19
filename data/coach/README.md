# Coach training set

The Qwen3.5 experiment uses the [reviewed manifest and grouped split](TRAIN.md). The seed and drafting workflow below documents the original corpus.

Text the optional on-device wording model would learn from. The running product does not read this folder. Photo, video, and live use [`config/coaching.yaml`](../../config/coaching.yaml) unless the player has opted into the WebGPU worker ([`web/src/workers/README.md`](../../web/src/workers/README.md)).

No images, landmarks, user ids, or model weights live here. Design notes: [`docs/PERSONALIZED_COACH.md`](../../docs/PERSONALIZED_COACH.md).

| Path | Tracked | What it is |
|---|---|---|
| `accepted.jsonl` | yes | Legacy template seeds: one row per `(criterion, severity, direction)` from `config/coaching.yaml` `variants[0]`. |
| `review_manifest_v1.json` | yes | Instructor-reviewed examples for the Qwen3.5 run. Training reads the split built from this file. |
| `probe.jsonl` | yes | 25 frozen hand-checked plans for the export gate. Never train on these. |
| `drafts/` | **no** | Base-model paraphrases from `draft_paraphrases`. **Unreviewed. Do not train on drafts.** |
| `adapters/` | **no** | LoRA adapter output from `mlx_lm.lora`. |
| `merged/` | **no** | Fused MLX weights from `mlx_lm.fuse`. |

## Row format

One JSON object per line, in the `mlx-lm` chat format:

```json
{"messages": [
  {"role": "system", "content": "You write one piano posture tip for a child. Use only the facts in the plan. Return JSON with keys problem and fix."},
  {"role": "user", "content": "{\"criterion\":\"wrist_height\",\"severity\":\"warning\",\"direction\":\"too_high\",\"score\":62,\"tip_kind\":\"live\"}"},
  {"role": "assistant", "content": "{\"problem\": \"…\", \"fix\": \"…\"}"}
]}
```

The user message is the short plan only (`criterion`, `severity`, `direction`,
`score`, `tip_kind`). The assistant message is the only training target.
Every line must pass `validate_tip(problem + " " + fix, plan)`;
`tests/engine/test_coach_draft.py` enforces this.

## Workflow

1. Draft locally with the base model (Apple Silicon, `.venv-coach`). No paid
   or hosted model may paraphrase.

   ```sh
   python -m technique_titan.coach.draft_paraphrases \
     --model mlx-community/Qwen3.5-0.8B-4bit \
     --templates config/coaching.yaml \
     --output data/coach/drafts/base.jsonl \
     --per-cell 8
   ```

   The script drops drafts that fail the validator, but surviving drafts are
   still unreviewed.
2. A human reads each draft. The original corpus kept approved lines in
   `accepted.jsonl`. The Qwen3.5 run keeps them in `review_manifest_v1.json`.
3. That run starts at **200** instructor-reviewed lines, with at least **8**
   per `(criterion, direction)` pair. See [`TRAIN.md`](TRAIN.md).
