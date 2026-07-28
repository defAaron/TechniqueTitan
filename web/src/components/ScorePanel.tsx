import type { HandResult } from '../lib/api'
import { CRITERION_LABELS, severityColor } from '../lib/api'

interface Props {
  hand: HandResult
  compact?: boolean
}

export function ScorePanel({ hand, compact = false }: Props) {
  return (
    <section className="animate-fade-up rounded-2xl border border-stone-300/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {hand.label} hand
        </h3>
        <span className="text-xs text-ink-muted">
          {(hand.confidence * 100).toFixed(0)}% conf.
        </span>
      </header>

      <p
        className={`mb-3 font-display font-bold tracking-tight ${compact ? 'text-3xl' : 'text-4xl'}`}
        style={{ color: severityColor(hand.composite_severity) }}
      >
        {hand.composite_score != null ? Math.round(hand.composite_score) : '—'}
        <span className="ml-1 text-sm font-medium text-ink-muted">/ 100</span>
      </p>

      <ul className="space-y-2">
        {Object.entries(CRITERION_LABELS).map(([key, label]) => {
          const score = hand.scores[key]
          const sev = hand.severities[key] ?? 'unknown'
          const pct = typeof score === 'number' ? score : 0
          return (
            <li key={key} className="grid grid-cols-[1fr_auto_2.5rem] items-center gap-2 text-sm">
              <span className="truncate text-ink-muted">{compact ? label.replace(' deviation', '') : label}</span>
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: severityColor(sev) }}
              >
                {sev}
              </span>
              <span className="text-right tabular-nums">
                {typeof score === 'number' ? Math.round(score) : '—'}
              </span>
              <div className="col-span-3 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: severityColor(sev) }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
