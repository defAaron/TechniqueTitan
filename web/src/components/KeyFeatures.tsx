import { useId, useRef, useState } from 'react'
import { CRITERION_LABELS } from '../lib/api'

interface Criterion {
  key: keyof typeof CRITERION_LABELS | string
  measures: string
  watch: string
  cue: string
}

/**
 * Tab content for the five scored criteria. Labels come from
 * CRITERION_LABELS so the marketing copy can never drift from the wording
 * used in results panels and coaching tips.
 */
const CRITERIA: Criterion[] = [
  {
    key: 'wrist_height',
    measures: 'Where your wrist sits relative to the knuckle line.',
    watch: 'A wrist collapsing below the keys, or riding up above the knuckles.',
    cue: 'Keep the wrist calm and level with the knuckles.',
  },
  {
    key: 'finger_curvature',
    measures: 'How much curve each long finger holds on the key.',
    watch: 'Fingers lying flat across the keys, or curling too tightly.',
    cue: 'Soften the joints — imagine holding a small soft bubble.',
  },
  {
    key: 'thumb_position',
    measures: 'How far the thumb sits from the rest of the hand.',
    watch: 'A thumb tucked tight against the hand, or flaring out wide.',
    cue: 'Rest the thumb on its side, ready to play.',
  },
  {
    key: 'wrist_lateral',
    measures: 'Sideways bend of the wrist against the forearm.',
    watch: 'The hand angling off toward the thumb side or the pinky side.',
    cue: 'Let the wrist sit straight in line with the forearm.',
  },
  {
    key: 'hand_arch',
    measures: 'The height of the arch across your knuckle bridge.',
    watch: 'A knuckle bridge that flattens out, or over-domes and stiffens.',
    cue: 'Hold a gentle dome across the knuckles — lifted, not locked.',
  },
]

export function KeyFeatures() {
  const [active, setActive] = useState(0)
  const baseId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusTab = (index: number) => {
    const next = (index + CRITERIA.length) % CRITERIA.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusTab(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusTab(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(CRITERIA.length - 1)
    }
  }

  const current = CRITERIA[active]

  return (
    <div className="rounded-3xl border border-line bg-surface/80 p-6 backdrop-blur-sm sm:p-8">
      <div
        role="tablist"
        aria-label="Key features"
        className="flex flex-wrap gap-1.5 border-b border-line pb-4"
      >
        {CRITERIA.map((criterion, i) => {
          const selected = i === active
          return (
            <button
              key={criterion.key}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${i}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected
                  ? 'bg-primary text-foreground shadow-[0_0_18px_rgba(74,92,255,0.45)]'
                  : 'text-muted hover:bg-surface-raised hover:text-foreground',
              ].join(' ')}
            >
              {CRITERION_LABELS[criterion.key] ?? criterion.key}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
        className="pt-6"
      >
        <h3 className="font-display text-2xl font-bold tracking-tight text-accent">
          {CRITERION_LABELS[current.key] ?? current.key}
        </h3>
        <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
          {current.measures}
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-background/60 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              What it catches
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-foreground">
              {current.watch}
            </dd>
          </div>
          <div className="rounded-2xl border border-accent/30 bg-accent/[0.08] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              The coaching cue
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-foreground">
              {current.cue}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
