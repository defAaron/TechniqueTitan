/// <reference lib="webworker" />
/**
 * On-device coaching wording (spec §7.4). Loads Transformers.js only after the
 * user turns the toggle on. The only network use is the weight download from
 * the configured Hugging Face repo; inference stays on this GPU.
 */
import type { InterruptableStoppingCriteria, TextGenerationPipeline } from '@huggingface/transformers'
import {
  COACH_GENERATION,
  modelMessages,
  parseModelTip,
  type ModelPlan,
  type WorkerRequest,
  type WorkerResponse,
} from '../lib/coachModelProtocol'

const scope = self as unknown as DedicatedWorkerGlobalScope

let generator: TextGenerationPipeline | null = null
let StoppingCtor: (new () => InterruptableStoppingCriteria) | null = null
let current: { id: number; stop: InterruptableStoppingCriteria } | null = null
const aborted = new Set<number>()
let queue: Promise<void> = Promise.resolve()

function post(message: WorkerResponse) {
  scope.postMessage(message)
}

async function load(repo: string, revision: string) {
  try {
    const transformers = await import('@huggingface/transformers')
    transformers.env.allowLocalModels = false
    StoppingCtor = transformers.InterruptableStoppingCriteria
    generator = (await transformers.pipeline('text-generation', repo, {
      dtype: 'q4f16',
      device: 'webgpu',
      revision,
      progress_callback: (info) => {
        if (info.status === 'progress_total') post({ type: 'progress', progress: info.progress })
      },
    })) as TextGenerationPipeline
    post({ type: 'ready' })
  } catch {
    generator = null
    post({ type: 'load-failed' })
  }
}

function assistantText(output: unknown): string | null {
  const first = Array.isArray(output) ? output[0] : null
  const generated = (first as { generated_text?: unknown } | null)?.generated_text
  if (typeof generated === 'string') return generated
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1] as { role?: string; content?: unknown } | undefined
    if (last?.role === 'assistant' && typeof last.content === 'string') return last.content
  }
  return null
}

async function generate(id: number, plan: ModelPlan) {
  if (aborted.delete(id)) return
  if (!generator || !StoppingCtor) {
    post({ type: 'result', id, ok: false })
    return
  }
  const stop = new StoppingCtor()
  current = { id, stop }
  try {
    const output = await generator(modelMessages(plan), {
      ...COACH_GENERATION,
      stopping_criteria: stop,
    })
    const text = assistantText(output)
    const tip = text ? parseModelTip(text) : null
    if (tip && !aborted.has(id)) post({ type: 'result', id, ok: true, ...tip })
    else post({ type: 'result', id, ok: false })
  } catch {
    post({ type: 'result', id, ok: false })
  } finally {
    aborted.delete(id)
    current = null
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  if (msg.type === 'load') {
    void load(msg.repo, msg.revision)
  } else if (msg.type === 'generate') {
    queue = queue.then(() => generate(msg.id, msg.plan))
  } else if (msg.type === 'abort') {
    aborted.add(msg.id)
    if (current?.id === msg.id) current.stop.interrupt()
  }
}
