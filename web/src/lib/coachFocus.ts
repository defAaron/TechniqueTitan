import { CRITERION_LABELS } from './api'
import {
  clampCoachScore,
  COACH_CRITERIA,
  type CoachCriterion,
} from './coachPlan'
import type { PracticeSessionListRow, SessionHandRow } from './progress'
import { supabase } from './supabase'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const COACH_FOCUS_EMPTY_MESSAGE = 'Practice a few times to get a weekly focus.'

const CRITERION_SET = new Set<string>(COACH_CRITERIA)

export type CoachFocusLock = {
  criterion: CoachCriterion
  locked_on: string
  locked_until: string
  burden: Record<string, number>
}

export type CoachFocusRow = CoachFocusLock & {
  user_id: string
  updated_at: string
}

export type CoachPlanHistoryHand = {
  hand: 'left' | 'right'
  mean_composite: number | null
  mean_scores: Record<string, number | null>
  frac_warning: Record<string, number>
  frac_critical: Record<string, number>
  primary_issue: string | null
}

export type CoachPlanHistoryEntry = {
  started_on: string
  hands: CoachPlanHistoryHand[]
}

export type ProgressCoachPlanBody = {
  hand: 'left' | 'right'
  scores: Record<string, number | null>
  severities: Record<string, string>
  metrics: Record<string, number | null>
  history: CoachPlanHistoryEntry[]
  tip_kind: 'recap'
  locked_focus: CoachFocusLock | null
}

export type CoachPlanProgressResponse = {
  lock: CoachFocusLock | null
}

export function sanitizePrimaryIssue(issue: string | null | undefined): string | null {
  if (!issue || !CRITERION_SET.has(issue)) return null
  return issue
}

export function scoreToCoachSeverity(score: number | null): string {
  if (score === null) return 'unknown'
  if (score >= 80) return 'good'
  if (score >= 50) return 'warning'
  return 'critical'
}

function handCompositeRank(composite: number | null): number {
  // Missing composites sort after every finite score.
  if (composite === null || !Number.isFinite(composite)) return Number.POSITIVE_INFINITY
  return composite
}

export function pickWeakerHand(hands: SessionHandRow[] | undefined): SessionHandRow | null {
  const list = hands ?? []
  if (!list.length) return null
  let chosen = list[0]
  for (const hand of list.slice(1)) {
    if (handCompositeRank(hand.mean_composite) < handCompositeRank(chosen.mean_composite)) {
      chosen = hand
    }
  }
  return chosen
}

export function mapSessionToPlanHistoryEntry(
  session: PracticeSessionListRow,
): CoachPlanHistoryEntry | null {
  const hands: CoachPlanHistoryHand[] = (session.session_hands ?? []).map((h) => ({
    hand: h.hand.toLowerCase() === 'left' ? 'left' : 'right',
    mean_composite: h.mean_composite,
    mean_scores: h.mean_scores ?? {},
    frac_warning: h.frac_warning ?? {},
    frac_critical: h.frac_critical ?? {},
    primary_issue: sanitizePrimaryIssue(h.primary_issue),
  }))
  if (!hands.length) return null
  return {
    started_on: session.started_at.slice(0, 10),
    hands,
  }
}

export function buildCoachPlanHistoryFromSessions(
  sessions: PracticeSessionListRow[],
): CoachPlanHistoryEntry[] {
  const history: CoachPlanHistoryEntry[] = []
  for (const session of sessions.slice(0, 40)) {
    const entry = mapSessionToPlanHistoryEntry(session)
    if (entry) history.push(entry)
  }
  return history
}

export function formatCoachFocusMessage(
  lock: Pick<CoachFocusLock, 'criterion' | 'locked_until'> | null,
  locales?: Intl.LocalesArgument,
): string {
  if (!lock) return COACH_FOCUS_EMPTY_MESSAGE
  const label = CRITERION_LABELS[lock.criterion] ?? lock.criterion.replace(/_/g, ' ')
  const dateStr = new Date(`${lock.locked_until}T12:00:00`).toLocaleDateString(locales)
  return `Weekly focus: ${label} until ${dateStr}`
}

function rowToLock(row: {
  criterion: string
  locked_on: string
  locked_until: string
  burden: Record<string, number> | null
}): CoachFocusLock | null {
  if (!CRITERION_SET.has(row.criterion)) return null
  return {
    criterion: row.criterion as CoachCriterion,
    locked_on: row.locked_on,
    locked_until: row.locked_until,
    burden: row.burden ?? {},
  }
}

export async function loadCoachFocusRow(userId: string): Promise<CoachFocusLock | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('coach_focus')
    .select('criterion, locked_on, locked_until, burden')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return rowToLock(data)
}

export function buildProgressCoachPlanRequest(
  sessions: PracticeSessionListRow[],
  lockedFocus: CoachFocusLock | null,
): ProgressCoachPlanBody {
  const newest = sessions[0]
  const weaker = pickWeakerHand(newest?.session_hands)
  const hand: 'left' | 'right' =
    weaker?.hand.toLowerCase() === 'left' ? 'left' : 'right'

  const scores: Record<string, number | null> = {}
  const severities: Record<string, string> = {}
  for (const name of COACH_CRITERIA) {
    const raw = weaker?.mean_scores?.[name] ?? null
    const clamped = clampCoachScore(raw)
    scores[name] = clamped
    severities[name] = scoreToCoachSeverity(clamped)
  }

  return {
    hand,
    scores,
    severities,
    metrics: {},
    history: buildCoachPlanHistoryFromSessions(sessions),
    tip_kind: 'recap',
    locked_focus: lockedFocus,
  }
}

export async function fetchProgressCoachPlan(
  body: ProgressCoachPlanBody,
): Promise<{ ok: true; lock: CoachFocusLock | null } | { ok: false }> {
  try {
    const res = await fetch(`${API_BASE}/v1/coach/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as CoachPlanProgressResponse
    const lock = data.lock
    if (lock == null) return { ok: true, lock: null }
    if (!CRITERION_SET.has(lock.criterion)) return { ok: true, lock: null }
    return {
      ok: true,
      lock: {
        criterion: lock.criterion as CoachCriterion,
        locked_on: lock.locked_on,
        locked_until: lock.locked_until,
        burden: lock.burden ?? {},
      },
    }
  } catch {
    return { ok: false }
  }
}

export async function upsertCoachFocusLock(
  userId: string,
  lock: CoachFocusLock,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('coach_focus').upsert(
    {
      user_id: userId,
      criterion: lock.criterion,
      locked_on: lock.locked_on,
      locked_until: lock.locked_until,
      burden: lock.burden,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}

/** Refresh via /v1/coach/plan; upsert when the API returns a lock. */
export async function syncWeeklyCoachFocus(
  userId: string,
  sessions: PracticeSessionListRow[],
  storedLock: CoachFocusLock | null = null,
): Promise<CoachFocusLock | null> {
  const stored = storedLock ?? (await loadCoachFocusRow(userId))
  const body = buildProgressCoachPlanRequest(sessions, stored)
  const outcome = await fetchProgressCoachPlan(body)
  if (!outcome.ok) return stored
  if (outcome.lock) {
    await upsertCoachFocusLock(userId, outcome.lock)
    return outcome.lock
  }
  return stored
}
