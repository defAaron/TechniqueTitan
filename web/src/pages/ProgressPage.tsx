import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../lib/auth'
import { CRITERION_LABELS } from '../lib/api'
import { loadCoachFocusRow, syncWeeklyCoachFocus, type CoachFocusLock } from '../lib/coachFocus'
import { useProfile } from '../lib/profile'
import { firstName } from '../lib/profileModel'
import {
  deletePracticeSession,
  getPracticeSession,
  last30DayStats,
  listPracticeSessions,
  type PracticeSessionDetail,
  type PracticeSessionListRow,
} from '../lib/progress'
import { ScoreDonutRing } from '../components/progress/ScoreDonutRing'
import { supabase } from '../lib/supabase'
import './ProgressDashboard.css'

const CRITERIA = [
  'wrist_height',
  'finger_curvature',
  'thumb_position',
  'wrist_lateral',
  'hand_arch',
] as const

const GREETING_TEMPLATES = [
  (name: string) => `Hey ${name}, good to see you again.`,
  (name: string) => `Great to have you back, ${name}.`,
  (name: string) => `Ready to practice, ${name}?`,
  (name: string) => `Welcome back, ${name}.`,
  (name: string) => `Here's how you've been doing so far, ${name}.`,
] as const

function randomGreetingIndex(): number {
  return Math.floor(Math.random() * GREETING_TEMPLATES.length)
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  )

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduce
}

const QUOTES = [
  {
    text: 'The body achieves what the mind believes.',
    author: 'Napoleon Hill',
  },
  {
    text: 'Small disciplines repeated with consistency lead to great achievements.',
    author: 'John C. Maxwell',
  },
  {
    text: 'I think I am making progress.',
    author: 'Pablo Casals',
  },
  {
    text: 'Knowledge is not skill. Knowledge plus ten thousand times is skill.',
    author: 'Shinichi Suzuki',
  },
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Aristotle',
  },
  {
    text:
      'I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.',
    author: 'Bruce Lee',
  },
  {
    text:
      "If I don't practice for one day, I know it; two days, the critics know it; three days, the public knows it.",
    author: 'Jascha Heifetz',
  },
  {
    text:
      'Practice with your fingers and you need all day. Practice with your mind and you will do as much in one and a half hours.',
    author: 'Leopold Auer',
  },
  {
    text: 'Great dancers are not great because of their technique, they are great because of their passion.',
    author: 'Martha Graham',
  },
  {
    text: 'Practice does not make perfect. Only perfect practice makes perfect.',
    author: 'Vince Lombardi',
  },
  {
    text: 'To achieve great things, two things are needed: a plan, and not quite enough time.',
    author: 'Leonard Bernstein',
  },
  {
    text: 'Life is denied by lack of attention, whether it be to cleaning windows or trying to write a masterpiece.',
    author: 'Nadia Boulanger',
  },
  {
    text: "The difference between the impossible and the possible lies in a person's determination.",
    author: 'Vladimir Horowitz',
  },
  {
    text: 'Mastery is not a function of genius or talent. It is a function of time and intense focus applied to a particular field of knowledge.',
    author: 'Robert Greene',
  },
] as const

function CalendarIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </svg>
  )
}

function sessionMeanComposite(session: PracticeSessionListRow): number | null {
  const values = (session.session_hands ?? [])
    .map((h) => h.mean_composite)
    .filter((v): v is number => v != null)
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function practiceStreak(sessions: PracticeSessionListRow[]): number {
  const dayKeys = new Set(
    sessions.map((s) => {
      const d = new Date(s.started_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    }),
  )
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 400; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    if (dayKeys.has(key)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else if (i === 0) {
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    photo: 'Photo analysis',
    video: 'Video analysis',
    live: 'Live practice',
  }
  return map[source.toLowerCase()] ?? source
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ProgressPage() {
  const { user, loading: authLoading } = useAuth()
  const { displayName } = useProfile()
  const [greetingIndex] = useState(randomGreetingIndex)
  const greeting = useMemo(
    () => GREETING_TEMPLATES[greetingIndex](firstName(displayName)),
    [greetingIndex, displayName],
  )
  const [sessions, setSessions] = useState<PracticeSessionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PracticeSessionDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [entered, setEntered] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (!user || !supabase) {
      setSessions([])
      setLoading(false)
      return
    }

    let storedLock: CoachFocusLock | null = null
    try {
      storedLock = await loadCoachFocusRow(user.id)
    } catch {
      storedLock = null
    }

    try {
      const rows = await listPracticeSessions()
      setSessions(rows)
      try {
        await syncWeeklyCoachFocus(user.id, rows, storedLock)
      } catch {
        // Coach focus sync is best-effort; session list stays loaded.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load progress')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void reload()
  }, [authLoading, reload])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % QUOTES.length)
    }, 5500)
    return () => window.clearInterval(timer)
  }, [])

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

  const stats = useMemo(() => last30DayStats(sessions), [sessions])
  const streak = useMemo(() => practiceStreak(sessions), [sessions])

  const chartData = useMemo(() => {
    const ordered = [...sessions].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    )
    return ordered
      .map((s) => ({
        date: formatShortDate(s.started_at),
        score: sessionMeanComposite(s),
      }))
      .filter((row) => row.score != null)
  }, [sessions])

  const focusScores = useMemo(() => {
    const latest = sessions[0]
    if (!latest) return []
    const hand =
      (latest.session_hands ?? []).find((h) => h.hand === 'Right') ??
      latest.session_hands?.[0]
    if (!hand?.mean_scores) return []
    return CRITERIA.map((key) => ({
      key,
      label: CRITERION_LABELS[key],
      value: hand.mean_scores[key] ?? 0,
    })).sort((a, b) => b.value - a.value)
  }, [sessions])

  const focusComposite = useMemo(() => {
    if (!focusScores.length) return null
    const vals = focusScores.map((f) => f.value).filter((v) => v > 0)
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [focusScores])

  const practiceHours = useMemo(() => {
    const hrs = stats.practiceMinutes / 60
    return hrs >= 10 ? hrs.toFixed(0) : hrs.toFixed(1)
  }, [stats.practiceMinutes])

  const recentSessions = useMemo(() => {
    return sessions.slice(0, 8).map((session, index) => {
      const score = sessionMeanComposite(session)
      const prev = sessions[index + 1]
      const prevScore = prev ? sessionMeanComposite(prev) : null
      let change = '—'
      if (score != null && prevScore != null) {
        const diff = score - prevScore
        change = diff === 0 ? '0' : `${diff > 0 ? '+' : ''}${diff}`
      }
      return { session, score, change }
    })
  }, [sessions])

  const metrics = useMemo(
    () => [
      {
        label: 'Overall score',
        value: stats.meanComposite != null ? String(stats.meanComposite) : '—',
        suffix: stats.meanComposite != null ? '/100' : '',
      },
      {
        label: 'Practice sessions',
        value: String(stats.sessionCount),
        suffix: '',
      },
      {
        label: 'Practice time',
        value: stats.practiceMinutes > 0 ? practiceHours : '0',
        suffix: stats.practiceMinutes > 0 ? 'hrs' : '',
      },
      {
        label: 'Current streak',
        value: String(streak),
        suffix: streak === 1 ? 'day' : 'days',
      },
    ],
    [stats, streak, practiceHours],
  )

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

  const pageReady = !loading && !authLoading

  useEffect(() => {
    if (!pageReady) {
      setEntered(false)
      setChartReady(false)
      return
    }
    if (reduceMotion) {
      setEntered(true)
      setChartReady(true)
      return
    }
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [pageReady, reduceMotion])

  useEffect(() => {
    if (!entered || reduceMotion || sessions.length === 0) {
      if (!entered || sessions.length === 0) setChartReady(false)
      return
    }
    const t = window.setTimeout(() => setChartReady(true), 420)
    return () => clearTimeout(t)
  }, [entered, reduceMotion, sessions.length])

  return (
    <div className={`progress-dashboard${entered ? ' pd-entered' : ''}`}>
      {(loading || authLoading) && (
        <p className="intro" role="status">Loading your saved sessions…</p>
      )}
      {error && <p className="status-banner" role="alert">{error}</p>}

      {pageReady && (
        <div className="page-heading pd-reveal" style={{ '--pd-delay': '0ms' } as CSSProperties}>
          <div>
            <h1 className="page-greeting">{greeting}</h1>
          </div>
          {sessions.length > 0 ? (
            <div className="date-control" aria-label="Reporting period">
              <CalendarIcon />
              Last 30 days
            </div>
          ) : null}
        </div>
      )}

      {pageReady && sessions.length === 0 && !error && (
        <p
          className="empty-state pd-reveal"
          style={{ '--pd-delay': '120ms' } as CSSProperties}
        >
          No saved sessions yet. After you analyze your posture, tap Add to progress on Photo,
          Video, or Live.
        </p>
      )}

      {pageReady && sessions.length > 0 && (
        <>

          <section className="metric-grid" aria-label="Progress summary">
            {metrics.map((metric, index) => (
              <article
                className="metric-card pd-reveal"
                key={metric.label}
                style={{ '--pd-delay': `${100 + index * 85}ms` } as CSSProperties}
              >
                <p className="metric-label">{metric.label}</p>
                <div className="metric-value">
                  {metric.value}
                  {metric.suffix ? <small>{metric.suffix}</small> : null}
                </div>
              </article>
            ))}
          </section>

          <section className="dashboard-grid" aria-label="Detailed progress">
            <article
              className="panel trend-panel pd-reveal"
              style={{ '--pd-delay': '440ms' } as CSSProperties}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Performance</p>
                  <h2>Posture score</h2>
                </div>
                <div className="legend">
                  <span />
                  Session average
                </div>
              </div>
              <div className="chart-wrap">
                {chartData.length > 0 && chartReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="progressChartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6eb0d4" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#6eb0d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#181818" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#6b6662', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#6b6662', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#0a0a0a',
                          border: '1px solid #232323',
                          borderRadius: 0,
                          fontSize: 14,
                        }}
                        labelStyle={{ color: '#a8a39e' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#6eb0d4"
                        strokeWidth={2}
                        fill="url(#progressChartFill)"
                        isAnimationActive={!reduceMotion}
                        animationDuration={1400}
                        animationEasing="ease-out"
                        dot={{
                          r: 3.5,
                          fill: '#0a0a0a',
                          stroke: '#6eb0d4',
                          strokeWidth: 1.5,
                        }}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : chartData.length > 0 ? (
                  <div className="chart-placeholder" aria-hidden />
                ) : (
                  <p className="intro">Save more sessions to draw your trend line.</p>
                )}
              </div>
            </article>

            <article
              className="panel focus-panel pd-reveal"
              style={{ '--pd-delay': '560ms' } as CSSProperties}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Focus areas</p>
                  <h2>Hand technique</h2>
                </div>
                {focusComposite != null ? (
                  <ScoreDonutRing value={focusComposite} active={entered} />
                ) : null}
              </div>
              <div className="alignment-list">
                {focusScores.length === 0 ? (
                  <p className="intro" style={{ marginTop: '1.5rem' }}>
                    Your latest session will show criterion scores here.
                  </p>
                ) : (
                  focusScores.map(({ label, value }, index) => (
                    <div className="alignment-row" key={label}>
                      <div>
                        <span>{label}</span>
                        <b>{Math.round(value)}</b>
                      </div>
                      <span className="progress-track">
                        <span
                          className="progress-track-fill"
                          style={
                            {
                              '--bar-target': `${Math.min(100, Math.max(0, value))}%`,
                              '--bar-delay': `${720 + index * 90}ms`,
                            } as CSSProperties
                          }
                        />
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article
              className="panel quote-panel pd-reveal"
              style={{ '--pd-delay': '680ms' } as CSSProperties}
              aria-live="polite"
            >
              <span className="quote-mark" aria-hidden>“</span>
              <div className="quote-content" key={quoteIndex}>
                <blockquote>{QUOTES[quoteIndex].text}</blockquote>
                <cite>— {QUOTES[quoteIndex].author}</cite>
              </div>
            </article>

            <article
              className="panel sessions-panel pd-reveal"
              style={{ '--pd-delay': '800ms' } as CSSProperties}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">History</p>
                  <h2>Recent sessions</h2>
                </div>
              </div>
              <div className="session-list">
                {recentSessions.map(({ session, score, change }) => (
                  <div className="session-row" key={session.id}>
                    <button
                      type="button"
                      className="session-row-button"
                      onClick={() =>
                        setSelectedId(session.id === selectedId ? null : session.id)
                      }
                      aria-expanded={selectedId === session.id}
                    >
                      <span className="session-date">{formatShortDate(session.started_at)}</span>
                      <span className="session-type">{formatSource(session.source)}</span>
                      <span className="session-score">
                        {score ?? '—'}
                        {score != null ? <small>/100</small> : null}
                      </span>
                      <span className="session-change">{change}</span>
                    </button>
                    <button
                      type="button"
                      className="session-delete"
                      onClick={() => void onDelete(session.id)}
                    >
                      Del
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </section>

          {selectedId && (
            <article
              className="panel detail-panel pd-reveal"
              style={{ '--pd-delay': '0ms' } as CSSProperties}
            >
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Session</p>
                  <h2>Detail</h2>
                </div>
              </div>
              {detailBusy && <p className="intro">Loading…</p>}
              {detail && !detailBusy && (
                <div className="alignment-list">
                  {(detail.session_hands ?? []).map((h) => (
                    <div className="alignment-row" key={h.hand}>
                      <div>
                        <span>{h.hand} hand</span>
                        <b>{h.mean_composite ?? '—'}</b>
                      </div>
                      {h.tip_problem ? (
                        <p className="intro" style={{ marginTop: 8 }}>
                          {h.tip_problem} {h.tip_fix}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {detail.samples?.length ? (
                    <p className="intro" style={{ marginTop: 16 }}>
                      Timeline samples are available for this session (stored in your account).
                    </p>
                  ) : (
                    <p className="intro" style={{ marginTop: 16 }}>
                      Timeline samples were cleared to save database space (summaries are kept).
                    </p>
                  )}
                </div>
              )}
            </article>
          )}
        </>
      )}
    </div>
  )
}
