/** Pure pieces shared by the coach model worker and the page code (spec §5.1, §7.4). */

/** Must equal the `system` message in `data/coach/accepted.jsonl`. */
export const COACH_SYSTEM_PROMPT =
  'You write one piano posture tip for a child. Use only the facts in the plan. ' +
  'Return JSON with keys problem and fix.'

export const COACH_MODEL_TIMEOUT_MS = 2500

export const COACH_GENERATION = {
  max_new_tokens: 64,
  temperature: 0.7,
  top_p: 0.9,
  do_sample: true,
} as const

export interface ModelPlan {
  criterion: string
  severity: string
  direction: string
  score: number
  tip_kind: string
}

export interface ModelTip {
  problem: string
  fix: string
}

export type WorkerRequest =
  | { type: 'load'; repo: string; revision: string }
  | { type: 'generate'; id: number; plan: ModelPlan }
  | { type: 'abort'; id: number }

export type WorkerResponse =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'load-failed' }
  | ({ type: 'result'; id: number } & ({ ok: true } & ModelTip | { ok: false }))

/** The only plan fields the model sees: no history, user id, or metrics. */
export function toModelPlan(plan: {
  criterion: string
  severity: string
  direction: string
  score?: number | null
  tip_kind?: string | null
}): ModelPlan | null {
  if (typeof plan.score !== 'number' || !Number.isFinite(plan.score)) return null
  if (!plan.tip_kind) return null
  return {
    criterion: plan.criterion,
    severity: plan.severity,
    direction: plan.direction,
    score: plan.score,
    tip_kind: plan.tip_kind,
  }
}

/** Same compact JSON as Python `json.dumps(..., separators=(",", ":"))`. */
export function modelUserMessage(plan: ModelPlan): string {
  return JSON.stringify({
    criterion: plan.criterion,
    severity: plan.severity,
    direction: plan.direction,
    score: plan.score,
    tip_kind: plan.tip_kind,
  })
}

export function modelMessages(plan: ModelPlan): Array<{ role: string; content: string }> {
  return [
    { role: 'system', content: COACH_SYSTEM_PROMPT },
    { role: 'user', content: modelUserMessage(plan) },
  ]
}

/** Port of Python `parse_tip`: first `{` to last `}`, two non-empty strings. */
export function parseModelTip(text: string): ModelTip | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let obj: unknown
  try {
    obj = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const { problem, fix } = obj as Record<string, unknown>
  if (typeof problem !== 'string' || typeof fix !== 'string') return null
  const p = problem.trim()
  const f = fix.trim()
  if (!p || !f) return null
  return { problem: p, fix: f }
}

export const COACH_MODEL_PREF_KEY = 'tt-coach-model'

export function readCoachModelPref(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(COACH_MODEL_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCoachModelPref(storage: Pick<Storage, 'setItem'> | null, on: boolean): void {
  try {
    storage?.setItem(COACH_MODEL_PREF_KEY, on ? '1' : '0')
  } catch {
    // Private mode / disabled storage: the toggle just doesn't persist.
  }
}

/** Repo id and revision are both required; either empty hides the toggle. */
export function coachModelSource(env: {
  VITE_COACH_MODEL_REPO?: string
  VITE_COACH_MODEL_REVISION?: string
}): { repo: string; revision: string } | null {
  const repo = env.VITE_COACH_MODEL_REPO?.trim() ?? ''
  const revision = env.VITE_COACH_MODEL_REVISION?.trim() ?? ''
  if (!repo || !revision) return null
  return { repo, revision }
}
