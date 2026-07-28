import type { HandResult } from '../lib/api'
import { CRITERION_LABELS, severityColor } from '../lib/api'

interface Props {
  hand: HandResult
}

export function CoachingTips({ hand }: Props) {
  const { coaching } = hand
  if (coaching.encouragement) {
    return (
      <div className="animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
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
            borderColor: severityColor(primary.severity),
            background:
              primary.severity === 'critical'
                ? 'rgba(185, 28, 28, 0.06)'
                : 'rgba(180, 83, 9, 0.08)',
          }}
        >
          <p className="mb-1 font-semibold">
            Focus first:{' '}
            {CRITERION_LABELS[primary.criterion] ?? primary.criterion}
          </p>
          <p className="text-ink-muted">{primary.problem}</p>
          <p className="mt-1 text-ink">{primary.fix}</p>
        </div>
      )}
      {extras.length > 0 && (
        <ul className="space-y-2 text-sm text-ink-muted">
          {extras.map((tip) => (
            <li key={`${tip.criterion}-${tip.priority}`}>
              <span className="font-medium text-ink">
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
