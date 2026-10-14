import type { Coaching, CoachingTip } from './api'

export const COACH_CRITERIA = [
  'wrist_height',
  'finger_curvature',
  'thumb_position',
  'wrist_lateral',
  'hand_arch',
] as const

export type CoachCriterion = (typeof COACH_CRITERIA)[number]

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export interface SmoothedCriterionSnapshot {
  severity: string
  direction: string
}

export interface CoachPlanResponse {
  plan: {
    hand: string
    criterion: string
    severity: string
    direction: string
    renderer: string
    score?: number | null
    tip_kind?: string | null
    metric_value?: number | null
    ideal?: number[] | null
  } | null
  problem: string | null
  fix: string | null
  encouragement: string | null
  plan_key: string | null
  lock: unknown | null
}

export function normalizeApiHand(label: string): 'left' | 'right' | null {
  const lower = label.trim().toLowerCase()
  if (lower === 'left') return 'left'
  if (lower === 'right') return 'right'
  return null
}

export function clampCoachScore(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  if (score < 0) return 0
  if (score > 100) return 100
  return score
}

/** Stable key from hand label plus smoothed severity and direction per criterion (not numeric score). */
export function buildHandCoachSignature(
  handLabel: string,
  criteria: Record<string, SmoothedCriterionSnapshot>,
): string {
  const parts = [handLabel.trim().toLowerCase()]
  for (const name of COACH_CRITERIA) {
    const snap = criteria[name]
    parts.push(name, snap?.severity ?? '', snap?.direction ?? '')
  }
  return parts.join('|')
}

export function buildCoachPlanRequestBody(input: {
  hand: 'left' | 'right'
  scores: Record<string, number | null>
  severities: Record<string, string>
  metrics: Record<string, number | null>
}) {
  const scores: Record<string, number | null> = {}
  const severities: Record<string, string> = {}
  for (const name of COACH_CRITERIA) {
    scores[name] = clampCoachScore(input.scores[name])
    severities[name] = String(input.severities[name] ?? 'unknown')
  }
  return {
    hand: input.hand,
    scores,
    severities,
    metrics: { ...input.metrics },
    history: [] as [],
    tip_kind: 'live' as const,
    locked_focus: null,
  }
}

export function applyCoachPlanToCoaching(
  previous: Coaching,
  response: CoachPlanResponse,
  lastAppliedPlanKey: string | null,
): { coaching: Coaching; appliedPlanKey: string | null; changed: boolean } {
  const { plan_key: planKey } = response
  if (planKey === lastAppliedPlanKey) {
    return { coaching: previous, appliedPlanKey: lastAppliedPlanKey, changed: false }
  }

  if (response.plan == null && response.encouragement) {
    return {
      coaching: {
        tips: [],
        primary: null,
        encouragement: response.encouragement,
      },
      appliedPlanKey: planKey,
      changed: true,
    }
  }

  if (response.plan && response.problem && response.fix) {
    const tip: CoachingTip = {
      criterion: response.plan.criterion,
      severity: response.plan.severity,
      direction: response.plan.direction,
      problem: response.problem,
      fix: response.fix,
      priority: 0,
    }
    return {
      coaching: {
        tips: [tip],
        primary: tip,
        encouragement: null,
      },
      appliedPlanKey: planKey,
      changed: true,
    }
  }

  return { coaching: previous, appliedPlanKey: planKey, changed: false }
}

/** Swap the primary tip's sentences, keeping criterion and severity from the plan. */
export function withPrimaryWording(
  coaching: Coaching,
  wording: { problem: string; fix: string },
): Coaching {
  const primary = coaching.primary
  if (!primary) return coaching
  const reworded: CoachingTip = { ...primary, problem: wording.problem, fix: wording.fix }
  return {
    ...coaching,
    primary: reworded,
    tips: coaching.tips.map((tip) =>
      tip.criterion === primary.criterion && tip.problem === primary.problem && tip.fix === primary.fix
        ? reworded
        : tip,
    ),
  }
}

export type CoachPlanFetchOutcome =
  | { ok: true; response: CoachPlanResponse }
  | { ok: false }

/** Apply a fetch outcome; failed fetches leave coaching unchanged. */
export function mergeCoachPlanFetch(
  previous: Coaching,
  lastAppliedPlanKey: string | null,
  outcome: CoachPlanFetchOutcome,
): { coaching: Coaching; appliedPlanKey: string | null } {
  if (!outcome.ok) {
    return { coaching: previous, appliedPlanKey: lastAppliedPlanKey }
  }
  const applied = applyCoachPlanToCoaching(previous, outcome.response, lastAppliedPlanKey)
  return {
    coaching: applied.coaching,
    appliedPlanKey: applied.appliedPlanKey,
  }
}

export async function fetchCoachPlan(
  body: ReturnType<typeof buildCoachPlanRequestBody>,
): Promise<CoachPlanFetchOutcome> {
  try {
    const res = await fetch(`${API_BASE}/v1/coach/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false }
    const response = (await res.json()) as CoachPlanResponse
    return { ok: true, response }
  } catch {
    return { ok: false }
  }
}
