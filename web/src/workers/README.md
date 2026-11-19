# Wording worker

Optional on-device language model that rewrites a coach tip. It does not score posture. It does not run on Render. The free API instance is about 512 MB and already hosts MediaPipe; a 0.5B model does not fit beside it, and the project constraint is to stay on free tiers with no paid inference API.

The worker file is `coachModel.worker.ts`. Page code talks to it through `lib/coachModel.ts` and `lib/coachModelProtocol.ts`.

## When it starts

Only after both are true:

1. `VITE_COACH_MODEL_REPO` and `VITE_COACH_MODEL_REVISION` are set at build time.
2. The player turns the toggle on in Settings, and the browser exposes WebGPU (`navigator.gpu`).

`@huggingface/transformers` is imported inside the worker at that moment, not on first paint. `env.allowLocalModels = false`. The pipeline is `text-generation` with `dtype: "q4f16"` and `device: "webgpu"`. The download is large (on the order of a few hundred megabytes) and then sits in the browser cache, which is why the feature is off by default.

## What the model is allowed to see

`toModelPlan` sends five fields: criterion, severity, direction, score, tip kind. No history, no user id, no raw metrics, no image. The system prompt is the same string as the `system` message in `data/coach/accepted.jsonl`: one piano tip for a child, JSON with `problem` and `fix`, facts limited to the plan.

Generation caps: `max_new_tokens` 64, temperature 0.7, top-p 0.9, sampling on. One generation per `plan_key` change, not per frame. The page aborts the request at 2500 ms.

## What happens to the output

The worker parses the first `{` … last `}` as JSON with two non-empty strings. The page runs `validateTip`. Anything the validator rejects, any timeout, any load failure, or WebGPU missing → the YAML template stays on screen. The server never trusts a model sentence it did not validate; persisted recap tips go through the Python validator on the way into a coach plan.

Training data and the “do not train on drafts” rule: [`data/coach/README.md`](../../../data/coach/README.md).
