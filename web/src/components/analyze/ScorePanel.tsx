import type { HandResult } from '../../lib/api'
import { CRITERION_LABELS, severityColor } from '../../lib/api'

interface Props {
  hand: HandResult
  compact?: boolean
}

export function ScorePanel({ hand, compact = false }: Props) {
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
