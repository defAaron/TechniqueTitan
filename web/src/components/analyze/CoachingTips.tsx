import type { HandResult } from '../../lib/api'
import { CRITERION_LABELS, severityColor } from '../../lib/api'

interface Props {
  hand: HandResult
}

export function CoachingTips({ hand }: Props) {
  const { coaching } = hand
  if (coaching.encouragement) {
    return (
      <div className="animate-fade-up rounded-2xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
        {coaching.encouragement}
      </div>
    )
  }
  if (!coaching.tips.length) return null

  const primary = coaching.primary
  const extras = coaching.tips.slice(1)

  return (
    <div className="animate-fade-up space-y-3">
      {primary && (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: `color-mix(in srgb, ${severityColor(primary.severity)} 45%, transparent)`,
            background:
              primary.severity === 'critical'
                ? 'rgba(248, 113, 113, 0.1)'
                : 'rgba(251, 191, 36, 0.1)',
          }}
        >
          <p
            className="mb-1 font-semibold"
            style={{ color: severityColor(primary.severity) }}
          >
            Focus first: {CRITERION_LABELS[primary.criterion] ?? primary.criterion}
          </p>
          <p className="text-muted">{primary.problem}</p>
          <p className="mt-1 text-foreground">{primary.fix}</p>
        </div>
      )}
      {extras.length > 0 && (
        <ul className="space-y-2 text-sm text-muted">
          {extras.map((tip) => (
            <li key={`${tip.criterion}-${tip.priority}`}>
              <span className="font-medium text-foreground">
                {CRITERION_LABELS[tip.criterion] ?? tip.criterion}
              </span>
              {' — '}
              {tip.problem} → {tip.fix}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
