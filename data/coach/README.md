# Coach training set

Text-only data for the optional on-device wording model
([`docs/PERSONALIZED_COACH.md`](../../docs/PERSONALIZED_COACH.md) §5–§6).
No images, landmarks, user ids, or model weights live here.

| Path | Tracked | What it is |
|---|---|---|
| `accepted.jsonl` | yes | Human-reviewed rows. The **only** file training reads. Seeded with one template row per `(criterion, severity, direction)` from `config/coaching.yaml` `variants[0]`. |
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
     --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
     --templates config/coaching.yaml \
     --output data/coach/drafts/base.jsonl \
     --per-cell 8
   ```

   The script drops drafts that fail the validator, but surviving drafts are
   still unreviewed.
2. A human reads each draft and copies only correct, kind, plain lines into
   `accepted.jsonl`.
3. Training starts at **200** accepted lines with at least **8** per
   `(criterion, direction)` pair. See [`TRAIN.md`](TRAIN.md).
