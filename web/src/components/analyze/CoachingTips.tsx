import type { HandResult } from '../../lib/api'
import { CRITERION_LABELS, severityColor } from '../../lib/api'

interface Props {
  hand: HandResult
}

export function CoachingTips({ hand }: Props) {
  const { coaching } = hand
  if (coaching.encouragement) {
    return (
      <div className="animate-fade-up border border-good/40 bg-good/10 px-4 py-4 text-base text-good">
        {coaching.encouragement}
      </div>
    )
  }
  if (!coaching.tips.length) return null

  const primary = coaching.primary
  const extras = coaching.tips.slice(1)

  return (
    <div className="animate-fade-up space-y-4">
      {primary && (
        <div
          className="border px-4 py-4 text-base"
          style={{
            borderColor: `color-mix(in srgb, ${severityColor(primary.severity)} 45%, transparent)`,
            background:
              primary.severity === 'critical'
                ? 'rgba(248, 113, 113, 0.1)'
                : 'rgba(251, 191, 36, 0.1)',
          }}
        >
          <p
            className="mb-2 font-cinematic text-lg"
            style={{ color: severityColor(primary.severity) }}
          >
            Focus first: {CRITERION_LABELS[primary.criterion] ?? primary.criterion}
          </p>
          <p className="font-light text-white/50">{primary.problem}</p>
          <p className="mt-1 text-white">{primary.fix}</p>
        </div>
      )}
      {extras.length > 0 && (
        <ul className="space-y-2 text-base text-white/50">
          {extras.map((tip) => (
            <li key={`${tip.criterion}-${tip.priority}`}>
              <span className="text-white">
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
