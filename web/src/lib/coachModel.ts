import { useSyncExternalStore } from 'react'
import {
  COACH_MODEL_TIMEOUT_MS,
  coachModelSource,
  readCoachModelPref,
  toModelPlan,
  writeCoachModelPref,
  type ModelTip,
  type WorkerRequest,
  type WorkerResponse,
} from './coachModelProtocol'
import { validateTip, type ValidatorPlan } from './coachValidate'

export type CoachModelStatus = 'off' | 'unsupported' | 'loading' | 'ready' | 'failed'

export interface CoachModelState {
  status: CoachModelStatus
  progress: number | null
}

export interface RewordPlan extends ValidatorPlan {
  criterion: string
  severity: string
  direction: string
  score?: number | null
  tip_kind?: string | null
}

export const coachModelSourceConfig = coachModelSource(import.meta.env)

let state: CoachModelState = { status: 'off', progress: null }
const listeners = new Set<() => void>()
let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (tip: ModelTip | null) => void>()

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function setState(next: CoachModelState) {
  state = next
  for (const listener of listeners) listener()
}

export function hasWebGpu(): boolean {
  if (typeof navigator === 'undefined') return false
  return Boolean((navigator as Navigator & { gpu?: unknown }).gpu)
}

function settlePending() {
  for (const resolve of pending.values()) resolve(null)
  pending.clear()
}

function onWorkerMessage(event: MessageEvent<WorkerResponse>) {
  const msg = event.data
  if (msg.type === 'progress') {
    setState({ status: 'loading', progress: Math.round(msg.progress) })
  } else if (msg.type === 'ready') {
    setState({ status: 'ready', progress: null })
  } else if (msg.type === 'load-failed') {
    stopWorker()
    setState({ status: 'failed', progress: null })
  } else if (msg.type === 'result') {
    const resolve = pending.get(msg.id)
    if (!resolve) return
    pending.delete(msg.id)
    resolve(msg.ok ? { problem: msg.problem, fix: msg.fix } : null)
  }
}

function startWorker() {
  if (worker || !coachModelSourceConfig) return
  const { repo, revision } = coachModelSourceConfig
  worker = new Worker(new URL('../workers/coachModel.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = onWorkerMessage
  worker.onerror = () => {
    stopWorker()
    setState({ status: 'failed', progress: null })
  }
  setState({ status: 'loading', progress: null })
  worker.postMessage({ type: 'load', repo, revision } satisfies WorkerRequest)
}

function stopWorker() {
  worker?.terminate()
  worker = null
  settlePending()
}

/** Toggle handler. Turning on without WebGPU leaves the preference off. */
export function setCoachModelEnabled(on: boolean) {
  if (!coachModelSourceConfig) return
  if (!on) {
    writeCoachModelPref(storage(), false)
    stopWorker()
    setState({ status: 'off', progress: null })
    return
  }
  if (!hasWebGpu()) {
    writeCoachModelPref(storage(), false)
    setState({ status: 'unsupported', progress: null })
    return
  }
  writeCoachModelPref(storage(), true)
  startWorker()
}

/** Resume a saved opt-in on page load; never starts a download without one. */
export function resumeCoachModelFromPref() {
  if (!coachModelSourceConfig || worker || !readCoachModelPref(storage())) return
  if (!hasWebGpu()) {
    writeCoachModelPref(storage(), false)
    setState({ status: 'unsupported', progress: null })
    return
  }
  startWorker()
}

export function useCoachModel(): CoachModelState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}

/** Pick the model sentence only when it is valid for this plan; otherwise the template. */
export function chooseTip(
  template: ModelTip,
  model: ModelTip | null,
  plan: RewordPlan,
): ModelTip & { renderer: 'model' | 'template' } {
  if (model && validateTip(`${model.problem} ${model.fix}`, plan).length === 0) {
    return { ...model, renderer: 'model' }
  }
  return { ...template, renderer: 'template' }
}

/**
 * Ask the on-device model to reword ``template`` for ``plan``. Resolves to the
 * template when the model is off or not ready, on worker failure, on timeout,
 * or when the sentence fails the validator.
 */
export function rewordTip(
  plan: RewordPlan,
  template: ModelTip,
  timeoutMs = COACH_MODEL_TIMEOUT_MS,
): Promise<ModelTip & { renderer: 'model' | 'template' }> {
  const modelPlan = toModelPlan(plan)
  const active = worker
  if (state.status !== 'ready' || !active || !modelPlan) {
    return Promise.resolve(chooseTip(template, null, plan))
  }
  const id = nextId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.delete(id)) return
      active.postMessage({ type: 'abort', id } satisfies WorkerRequest)
      resolve(chooseTip(template, null, plan))
    }, timeoutMs)
    pending.set(id, (tip) => {
      clearTimeout(timer)
      resolve(chooseTip(template, tip, plan))
    })
    active.postMessage({ type: 'generate', id, plan: modelPlan } satisfies WorkerRequest)
  })
}
