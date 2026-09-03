import type { HandResult } from '../../lib/api'
import { CRITERION_LABELS, severityColor } from '../../lib/api'

const SHORT_LABELS: Record<string, string> = {
  wrist_height: 'Wrist height',
  finger_curvature: 'Finger curve',
  thumb_position: 'Thumb',
  wrist_lateral: 'Wrist lateral',
  hand_arch: 'Hand arch',
}

interface Props {
  hand: HandResult
  compact?: boolean
  /** Tighter two-column live layout: inline bars, coaching in the same card. */
  dense?: boolean
}

export function ScorePanel({ hand, compact = false, dense = false }: Props) {
  if (dense) return <DenseScorePanel hand={hand} />

  return (
    <section className="animate-fade-up border border-white/10 bg-zinc-950 p-5">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="font-cinematic text-xl font-normal tracking-tight text-white">
          {hand.label} hand
        </h3>
        <span className="font-body text-sm uppercase tracking-widest text-white/40">
          {(hand.confidence * 100).toFixed(0)}% conf.
        </span>
      </header>

      <p
        className={`mb-4 font-cinematic font-normal tracking-tight ${compact ? 'text-4xl' : 'text-5xl'}`}
        style={{ color: severityColor(hand.composite_severity) }}
      >
        {hand.composite_score != null ? Math.round(hand.composite_score) : '—'}
        <span className="ml-1 font-body text-base font-light text-white/40">/ 100</span>
      </p>

      <ul className="space-y-3">
        {Object.entries(CRITERION_LABELS).map(([key, label]) => {
          const score = hand.scores[key]
          const sev = hand.severities[key] ?? 'unknown'
          const pct = typeof score === 'number' ? score : 0
          return (
            <li key={key} className="grid grid-cols-[1fr_auto_2.5rem] items-center gap-2 text-base">
              <span className="truncate text-white/50">
                {compact ? label.replace(' deviation', '') : label}
              </span>
              <span
                className="font-body text-sm font-medium uppercase tracking-wide"
                style={{ color: severityColor(sev) }}
              >
                {sev}
              </span>
              <span className="text-right tabular-nums text-white">
                {typeof score === 'number' ? Math.round(score) : '—'}
              </span>
              <div className="col-span-3 h-px overflow-hidden bg-white/10">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: severityColor(sev),
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function DenseScorePanel({ hand }: { hand: HandResult }) {
  const { coaching } = hand
  const primary = coaching.primary
  const extras = coaching.tips.slice(1)

  return (
    <section className="flex h-full flex-col border border-white/10 bg-zinc-950 p-3">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-cinematic text-lg font-normal tracking-tight text-white">
          {hand.label} hand
        </h3>
        <p
          className="font-cinematic text-2xl font-normal tracking-tight"
          style={{ color: severityColor(hand.composite_severity) }}
        >
          {hand.composite_score != null ? Math.round(hand.composite_score) : '—'}
          <span className="ml-1 font-body text-xs font-light text-white/40">/ 100</span>
        </p>
      </header>

      <ul className="space-y-1.5">
        {Object.entries(SHORT_LABELS).map(([key, label]) => {
          const score = hand.scores[key]
          const sev = hand.severities[key] ?? 'unknown'
          const pct = typeof score === 'number' ? score : 0
          return (
            <li key={key} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-white/50">{label}</span>
                <span
                  className="shrink-0 font-body text-xs font-medium uppercase tracking-wide"
                  style={{ color: severityColor(sev) }}
                >
                  {sev}
                </span>
                <span className="w-7 shrink-0 text-right tabular-nums text-white">
                  {typeof score === 'number' ? Math.round(score) : '—'}
                </span>
              </div>
              <div className="h-1 overflow-hidden bg-white/10">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: severityColor(sev),
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {coaching.encouragement ? (
        <p className="mt-3 border-t border-good/30 pt-2 text-sm text-good">
          {coaching.encouragement}
        </p>
      ) : primary ? (
        <div className="mt-3 border-t border-white/10 pt-2 text-sm">
          <p style={{ color: severityColor(primary.severity) }}>
            Focus: {SHORT_LABELS[primary.criterion] ?? CRITERION_LABELS[primary.criterion] ?? primary.criterion}
          </p>
          <p className="mt-0.5 leading-snug text-white/70">{primary.fix}</p>
          {extras.length > 0 && (
            <details className="mt-1 text-white/45">
              <summary className="cursor-pointer text-xs uppercase tracking-widest">
                {extras.length} more
              </summary>
              <ul className="mt-1 space-y-1">
                {extras.map((tip) => (
                  <li key={`${tip.criterion}-${tip.priority}`}>
                    {SHORT_LABELS[tip.criterion] ?? tip.criterion} — {tip.fix}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : null}
    </section>
  )
}
