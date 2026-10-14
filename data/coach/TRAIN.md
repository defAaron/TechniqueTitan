# Coach LoRA training (local, Apple Silicon)

Spec: [`docs/PERSONALIZED_COACH.md`](../../docs/PERSONALIZED_COACH.md) §1.1, §5.4, §6.
Everything here runs on the developer Mac. Nothing is installed in the API
image, and adapters / merged weights stay gitignored.

## Status (2026-10-14)

**Not trained.** `accepted.jsonl` holds the **30** template seed rows only
(one per `(criterion, severity, direction)` from `variants[0]`). Training
waits for a human review that brings it to **200** accepted lines with at
least **8** per `(criterion, direction)` pair. Do not pad the file with
unreviewed drafts to reach the count. No gate rate has been measured yet.

## Environment

Pinned: `mlx-lm==0.30.2` (`requirements-coach.txt`). Verified on this Mac
(arm64, Python 3.11): `import mlx_lm` works and MLX reports `Device(gpu, 0)`.

```sh
python3.11 -m venv .venv-coach
.venv-coach/bin/pip install -r requirements-coach.txt
.venv-coach/bin/pip install -e . --no-deps
.venv-coach/bin/pip install opencv-python-headless==4.10.0.84
```

The last two lines let the drafter and eval import `technique_titan`
(`coaching.py` imports OpenCV). `mlx-lm` pulls NumPy 2 into this venv; that
is fine because the coach venv never loads MediaPipe. Keep the API `.venv`
on NumPy `<2`.

## 1. Drafts → review

See [`README.md`](README.md). Drafts go to `data/coach/drafts/` and are never
trained on. A human copies kept lines into `accepted.jsonl`.

## 2. Split 90 / 10 by cell

```sh
.venv-coach/bin/python -m technique_titan.coach.eval_adapter split
```

Writes `data/coach/split/{train,valid}.jsonl` (gitignored) and
`data/coach/split.json` (dev line numbers; commit it with the accepted set).

## 3. Train

`mlx-lm` 0.30.2 renamed `--lora-layers` to `--num-layers`, and rank, alpha,
dropout, and target modules can only be set from a config file. The config
[`lora_config.yaml`](lora_config.yaml) holds the spec values:

| Spec | `lora_config.yaml` |
|---|---|
| `q_proj`, `k_proj`, `v_proj`, `o_proj` | `lora_parameters.keys: [self_attn.q_proj, …]` |
| `r=8`, `alpha=16`, `dropout=0.05` | `rank: 8`, `scale: 2.0` (alpha / r), `dropout: 0.05` |
| AdamW, lr `1e-4`, 600 iters, batch 4, max seq 512, seed 0 | same keys |
| "every attention block" | `num_layers: -1` (Qwen2.5-0.5B has 24 layers, not 16) |
| assistant message is the only target | `mask_prompt: true` |

Exact command:

```sh
.venv-coach/bin/mlx_lm.lora -c data/coach/lora_config.yaml
```

## 4. Gate

```sh
.venv-coach/bin/python -m technique_titan.coach.eval_adapter eval \
  --adapter-path data/coach/adapters
```

Prints validator pass rate and exact-match rate (variety; lower is fine) for
dev and `probe.jsonl`. Exit 0 only when the validator pass rate is
**≥ 0.95 on both**. If it fails: add reviewed lines and train again. Do not
fuse or upload.

Record each run here:

| Date | Accepted lines | Dev pass | Probe pass | Dev exact | Gate |
|---|---|---|---|---|---|
| — | 30 (seed only) | not run | not run | not run | not trained |

## 5. Fuse (only after the gate passes)

```sh
.venv-coach/bin/mlx_lm.fuse \
  --model mlx-community/Qwen2.5-0.5B-Instruct-4bit \
  --adapter-path data/coach/adapters \
  --save-path data/coach/merged
```

Then Phase 7 (spec §7.1): convert `data/coach/merged` to ONNX `q4f16` and
upload to the public `technique-titan-coach-onnx` Hugging Face repo.
