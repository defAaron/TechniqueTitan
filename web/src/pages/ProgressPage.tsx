import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/layout'
import { CRITERION_LABELS } from '../lib/api'
import {
  compositeTrendData,
  criterionTrendData,
  deletePracticeSession,
  getPracticeSession,
  habitInsight,
  last30DayStats,
  listPracticeSessions,
  type PracticeSessionDetail,
  type PracticeSessionListRow,
} from '../lib/progress'

const CRITERIA = [
  'wrist_height',
  'finger_curvature',
  'thumb_position',
  'wrist_lateral',
  'hand_arch',
] as const

export function ProgressPage() {
  const [sessions, setSessions] = useState<PracticeSessionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PracticeSessionDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await listPracticeSessions()
      setSessions(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load progress')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailBusy(true)
    void getPracticeSession(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailBusy(false))
  }, [selectedId])

  const compositeChart = useMemo(() => compositeTrendData(sessions), [sessions])
  const criterionChart = useMemo(() => criterionTrendData(sessions, 'Right'), [sessions])
  const stats = useMemo(() => last30DayStats(sessions), [sessions])
  const insight = useMemo(() => habitInsight(sessions), [sessions])

  const handLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const s of sessions) {
      for (const h of s.session_hands ?? []) labels.add(`${h.hand} hand`)
    }
    return [...labels].sort()
  }, [sessions])

  async function onDelete(id: string) {
    if (!window.confirm('Delete this saved session?')) return
    try {
      await deletePracticeSession(id)
      if (selectedId === id) setSelectedId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const detailChart = useMemo(() => {
    if (!detail?.samples?.length) return []
    const byHand: Record<string, typeof detail.samples> = {}
    for (const s of detail.samples) {
      byHand[s.hand] ??= []
      byHand[s.hand].push(s)
    }
    const maxLen = Math.max(0, ...Object.values(byHand).map((a) => a.length))
    const rows: Record<string, number | null>[] = []
    for (let i = 0; i < maxLen; i++) {
      const row: Record<string, number | null> = { i }
      for (const [hand, samples] of Object.entries(byHand)) {
        row[`${hand} hand`] = samples[i]?.composite ?? null
      }
      rows.push(row)
    }
    return rows
  }, [detail])

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Account" title="Progress">
        Saved practice sessions store scores only — never photos or video. Use Photo, Video, or
        Live, then choose Add to progress.
      </PageHeader>

      {loading && (
        <p className="font-body text-sm text-white/50">Loading your saved sessions…</p>
      )}
      {error && (
        <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
          {error}
        </p>
      )}

      {!loading && sessions.length === 0 && (
        <p className="font-body text-base text-white/50">
          No saved sessions yet. After you analyze your posture, tap Add to progress on Photo,
          Video, or Live.
        </p>
      )}

      {sessions.length > 0 && (
        <>
          <section className="grid gap-4 border border-white/10 bg-zinc-950 p-6 sm:grid-cols-3">
            <Stat label="Sessions (30d)" value={String(stats.sessionCount)} />
            <Stat label="Practice minutes (30d)" value={String(stats.practiceMinutes)} />
            <Stat
              label="Mean composite (30d)"
              value={stats.meanComposite != null ? String(stats.meanComposite) : '—'}
            />
          </section>

          {insight && (
            <p className="font-body text-base text-white/70">{insight}</p>
          )}

          {compositeChart.length > 0 && (
            <ChartSection title="Composite score over time">
              <LineChart data={compositeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9a9a9a' }} />
                <Legend wrapperStyle={{ color: '#9a9a9a', fontSize: 13 }} />
                {handLabels.map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={idx === 0 ? '#ffffff' : '#9a9a9a'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartSection>
          )}

          {criterionChart.length > 0 && (
            <ChartSection title="Criteria over time (right hand)">
              <LineChart data={criterionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9a9a9a' }} />
                <Legend wrapperStyle={{ color: '#9a9a9a', fontSize: 11 }} />
                {CRITERIA.map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={CRITERION_LABELS[key]}
                    stroke={['#fff', '#ccc', '#999', '#666', '#444'][idx]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ChartSection>
          )}

          <section className="space-y-4">
            <h2 className="font-cinematic text-2xl font-normal text-white">Saved sessions</h2>
            <ul className="divide-y divide-white/10 border border-white/10">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-4 bg-zinc-950 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                    className="min-w-0 flex-1 text-left font-body text-sm text-white/80 hover:text-white"
                  >
                    <span className="block font-medium text-white">
                      {new Date(s.started_at).toLocaleString()} · {s.source}
                    </span>
                    <span className="text-white/50">
                      {Math.round(s.duration_s)}s · {s.frames_kept} samples kept
                    </span>
                    {(s.session_hands ?? []).map((h) => (
                      <span key={h.hand} className="mt-1 block text-white/60">
                        {h.hand}: mean {h.mean_composite ?? '—'}
                        {h.primary_issue ? ` · focus ${h.primary_issue.replace(/_/g, ' ')}` : ''}
                      </span>
                    ))}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(s.id)}
                    className="border border-white/20 px-4 py-2 font-body text-xs uppercase tracking-widest text-white/60 hover:border-critical/50 hover:text-critical"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selectedId && (
            <section className="border border-white/10 bg-zinc-950 p-6">
              <h2 className="mb-4 font-cinematic text-xl text-white">Session detail</h2>
              {detailBusy && <p className="text-sm text-white/50">Loading…</p>}
              {detail && !detailBusy && (
                <div className="space-y-6">
                  {(detail.session_hands ?? []).map((h) => (
                    <div key={h.hand} className="space-y-2 text-sm text-white/70">
                      <p className="text-white">{h.hand} hand</p>
                      <p>
                        Mean composite {h.mean_composite ?? '—'} · 10th percentile{' '}
                        {h.p10_composite ?? '—'}
                      </p>
                      {h.tip_problem && (
                        <p className="text-white/60">
                          {h.tip_problem} {h.tip_fix}
                        </p>
                      )}
                    </div>
                  ))}
                  {detailChart.length > 0 ? (
                    <ChartSection title="Score timeline (if still stored)">
                      <LineChart data={detailChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="i" tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9a9a9a' }} stroke="#2a2a2a" />
                        <Tooltip contentStyle={tooltipStyle} />
                        {Object.keys(detailChart[0] ?? {})
                          .filter((k) => k !== 'i')
                          .map((key, idx) => (
                            <Line
                              key={key}
                              type="monotone"
                              dataKey={key}
                              stroke={idx === 0 ? '#ffffff' : '#9a9a9a'}
                              dot={false}
                              connectNulls
                            />
                          ))}
                      </LineChart>
                    </ChartSection>
                  ) : (
                    <p className="text-sm text-white/40">
                      Timeline samples were cleared to save database space (summaries are kept).
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

const tooltipStyle = {
  background: '#0c0c0c',
  border: '1px solid #2a2a2a',
  borderRadius: 0,
  color: '#ffffff',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-body text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className="font-cinematic text-3xl text-white">{value}</p>
    </div>
  )
}

function ChartSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-white/10 bg-zinc-950 p-5">
      <h2 className="mb-4 font-cinematic text-2xl font-normal text-white">{title}</h2>
      <div className="h-72 w-full">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </section>
  )
}
