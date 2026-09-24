/** Save and load practice session progress via Supabase (scores only). */

import type { SessionDraftOut } from './api'
import { supabase } from './supabase'

const MAX_SESSIONS_PER_USER = 400
const SAMPLE_RETENTION_COUNT = 20
const MAX_SAMPLES_BYTES = 32 * 1024

export type PracticeSessionListRow = {
  id: string
  source: string
  started_at: string
  duration_s: number
  frames_kept: number
  scoring_version: string
  session_hands: SessionHandRow[]
}

export type SessionHandRow = {
  hand: string
  frames_kept: number
  mean_composite: number | null
  p10_composite: number | null
  mean_scores: Record<string, number | null>
  frac_warning: Record<string, number>
  frac_critical: Record<string, number>
  primary_issue: string | null
  tip_problem: string | null
  tip_fix: string | null
}

export type PracticeSessionDetail = PracticeSessionListRow & {
  samples: Array<{
    t_ms: number
    hand: string
    confidence: number
    composite: number | null
    scores: Record<string, number | null>
    severities: Record<string, string>
  }>
}

function assertClient() {
  if (!supabase) {
    throw new Error('Sign-in is not configured in this build.')
  }
  return supabase
}

function samplesByteSize(samples: SessionDraftOut['samples']): number {
  return new TextEncoder().encode(JSON.stringify(samples)).length
}

export async function saveProgressSession(
  draft: SessionDraftOut,
  userId: string,
): Promise<string> {
  const client = assertClient()
  if (!draft.hands.length) {
    throw new Error('Nothing to save — no hands passed quality checks.')
  }
  if (samplesByteSize(draft.samples) > MAX_SAMPLES_BYTES) {
    throw new Error('Session timeline is too large to store. Try a shorter clip.')
  }

  const { count, error: countErr } = await client
    .from('practice_sessions')
    .select('id', { count: 'exact', head: true })

  if (countErr) throw new Error(countErr.message)
  if ((count ?? 0) >= MAX_SESSIONS_PER_USER) {
    throw new Error(
      `You have ${MAX_SESSIONS_PER_USER} saved sessions. Delete an older one before saving another.`,
    )
  }

  const now = new Date().toISOString()
  const { data: sessionRow, error: sessionErr } = await client
    .from('practice_sessions')
    .insert({
      user_id: userId,
      source: draft.source,
      started_at: now,
      ended_at: now,
      duration_s: draft.duration_s,
      frames_seen: draft.frames_seen,
      frames_kept: draft.frames_kept,
      scoring_version: draft.scoring_version,
      samples: draft.samples,
    })
    .select('id')
    .single()

  if (sessionErr) throw new Error(sessionErr.message)
  const sessionId = sessionRow.id as string

  const handRows = draft.hands.map((h) => ({
    session_id: sessionId,
    hand: h.hand,
    frames_kept: h.frames_kept,
    mean_composite: h.mean_composite,
    p10_composite: h.p10_composite,
    mean_scores: h.mean_scores,
    frac_warning: h.frac_warning,
    frac_critical: h.frac_critical,
    primary_issue: h.primary_issue,
    tip_problem: h.tip_problem,
    tip_fix: h.tip_fix,
  }))

  const { error: handsErr } = await client.from('session_hands').insert(handRows)
  if (handsErr) {
    await client.from('practice_sessions').delete().eq('id', sessionId)
    throw new Error(handsErr.message)
  }

  await pruneOldSamples(client, userId)
  return sessionId
}

async function pruneOldSamples(
  client: NonNullable<typeof supabase>,
  userId: string,
) {
  const { data: recent, error } = await client
    .from('practice_sessions')
    .select('id')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(SAMPLE_RETENTION_COUNT, 999)

  if (error || !recent?.length) return

  const ids = recent.map((r) => r.id)
  await client.from('practice_sessions').update({ samples: [] }).in('id', ids)
}

export async function listPracticeSessions(): Promise<PracticeSessionListRow[]> {
  const client = assertClient()
  const { data, error } = await client
    .from('practice_sessions')
    .select(
      `
      id,
      source,
      started_at,
      duration_s,
      frames_kept,
      scoring_version,
      session_hands (
        hand,
        frames_kept,
        mean_composite,
        p10_composite,
        mean_scores,
        frac_warning,
        frac_critical,
        primary_issue,
        tip_problem,
        tip_fix
      )
    `,
    )
    .order('started_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as PracticeSessionListRow[]
}

export async function getPracticeSession(id: string): Promise<PracticeSessionDetail | null> {
  const client = assertClient()
  const { data, error } = await client
    .from('practice_sessions')
    .select(
      `
      id,
      source,
      started_at,
      duration_s,
      frames_kept,
      scoring_version,
      samples,
      session_hands (
        hand,
        frames_kept,
        mean_composite,
        p10_composite,
        mean_scores,
        frac_warning,
        frac_critical,
        primary_issue,
        tip_problem,
        tip_fix
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return data as PracticeSessionDetail
}

export async function deletePracticeSession(id: string): Promise<void> {
  const client = assertClient()
  const { error } = await client.from('practice_sessions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

const CRITERION_KEYS = [
  'wrist_height',
  'finger_curvature',
  'thumb_position',
  'wrist_lateral',
  'hand_arch',
] as const

export function last30DayStats(sessions: PracticeSessionListRow[]) {
  const cutoff = Date.now() - 30 * 86400000
  const recent = sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff)
  let minutes = 0
  const composites: number[] = []
  for (const s of recent) {
    minutes += s.duration_s / 60
    for (const h of s.session_hands ?? []) {
      if (h.mean_composite != null) composites.push(h.mean_composite)
    }
  }
  return {
    sessionCount: recent.length,
    practiceMinutes: Math.round(minutes),
    meanComposite:
      composites.length > 0
        ? Math.round(composites.reduce((a, b) => a + b, 0) / composites.length)
        : null,
  }
}

export function compositeTrendData(sessions: PracticeSessionListRow[]) {
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )
  return ordered.map((s) => {
    const row: Record<string, string | number | null> = {
      date: new Date(s.started_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }
    for (const h of s.session_hands ?? []) {
      row[`${h.hand} hand`] = h.mean_composite
    }
    return row
  })
}

export function criterionTrendData(
  sessions: PracticeSessionListRow[],
  hand: 'Left' | 'Right' = 'Right',
) {
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  )
  return ordered.map((s) => {
    const row: Record<string, string | number | null> = {
      date: new Date(s.started_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }
    const match = (s.session_hands ?? []).find((h) => h.hand === hand)
    for (const key of CRITERION_KEYS) {
      row[key] = match?.mean_scores?.[key] ?? null
    }
    return row
  })
}

export function habitInsight(sessions: PracticeSessionListRow[], days = 30): string | null {
  const cutoff = Date.now() - days * 86400000
  const issues: Record<string, number> = {}
  for (const session of sessions) {
    if (new Date(session.started_at).getTime() < cutoff) continue
    for (const row of session.session_hands ?? []) {
      if (!row.primary_issue) continue
      issues[row.primary_issue] = (issues[row.primary_issue] ?? 0) + 1
    }
  }
  if (!Object.keys(issues).length) return null
  const top = Object.entries(issues).sort((a, b) => b[1] - a[1])[0]
  const label = top[0].replace(/_/g, ' ')
  return `In your recent saved sessions, “${label}” was the most common focus area (${top[1]} session(s)).`
}
