import { Reveal } from './Reveal'

const stages = [
  {
    id: 'capture',
    n: '01',
    title: 'Capture',
    detail: 'Photo · Video · Live cam',
    tone: 'cyan' as const,
  },
  {
    id: 'detect',
    n: '02',
    title: 'Detect',
    detail: '21 MediaPipe landmarks',
    tone: 'blue' as const,
  },
  {
    id: 'measure',
    n: '03',
    title: 'Measure',
    detail: 'Angles · Distances · Arch',
    tone: 'cyan' as const,
  },
  {
    id: 'score',
    n: '04',
    title: 'Score',
    detail: '5 criteria · severity bands',
    tone: 'blue' as const,
  },
  {
    id: 'coach',
    n: '05',
    title: 'Coach',
    detail: 'Prioritized plain-language tips',
    tone: 'cyan' as const,
  },
]

function Connector({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    return (
      <div aria-hidden="true" className="flex flex-col items-center py-1">
        <div className="h-6 w-px bg-gradient-to-b from-primary via-accent to-primary" />
        <div className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(248,178,178,0.7)]" />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="relative mx-[-2px] hidden h-px flex-1 self-center bg-gradient-to-r from-primary via-accent to-primary lg:block"
    >
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_rgba(248,178,178,0.7)]" />
    </div>
  )
}

/**
 * Horizontal (desktop) / vertical (mobile) pipeline diagram for How it works.
 * Pure CSS + SVG so it stays on-palette without a charting dependency.
 */
export function PipelineFlow() {
  return (
    <Reveal className="relative overflow-hidden rounded-3xl border border-line bg-surface/80 p-5 sm:p-8">
      <div aria-hidden="true" className="tech-grid pointer-events-none absolute inset-0 opacity-40" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
      />

      <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Data pipeline
          </p>
          <p className="mt-1 text-sm text-muted">
            From a camera frame to a single coaching cue.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(248,178,178,0.6)]" />
            Browser
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(64,61,136,0.6)]" />
            API
          </span>
        </div>
      </div>

      {/* Desktop / tablet row */}
      <ol className="relative hidden items-stretch gap-0 lg:flex">
        {stages.map((stage, i) => (
          <li key={stage.id} className="flex min-w-0 flex-1 items-stretch">
            <StageCard stage={stage} index={i} />
            {i < stages.length - 1 && <Connector />}
          </li>
        ))}
      </ol>

      {/* Mobile / small column */}
      <ol className="relative flex flex-col lg:hidden">
        {stages.map((stage, i) => (
          <li key={stage.id} className="flex flex-col items-stretch">
            <StageCard stage={stage} index={i} />
            {i < stages.length - 1 && <Connector vertical />}
          </li>
        ))}
      </ol>

      {/* Branch note under capture → detect */}
      <div className="relative mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
        <Branch
          label="Live path"
          body="Landmarks stay on-device; only compact coordinates hit the API."
        />
        <Branch
          label="Photo / video path"
          body="Frames go to the scoring engine; overlays and timelines come back."
        />
        <Branch
          label="Output"
          body="Composite score, per-criterion bands, and a prioritized fix."
        />
      </div>
    </Reveal>
  )
}

function StageCard({
  stage,
  index,
}: {
  stage: (typeof stages)[number]
  index: number
}) {
  const cyan = stage.tone === 'cyan'
  return (
    <div
      className={[
        'group relative flex w-full flex-col rounded-2xl border px-4 py-4 transition-all duration-300',
        cyan
          ? 'border-accent/25 bg-background/70 hover:border-accent/55 hover:glow-cyan'
          : 'border-primary/25 bg-background/70 hover:border-primary/55 hover:glow-blue',
      ].join(' ')}
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={[
            'font-display text-xs font-bold tabular-nums',
            cyan ? 'text-accent/70' : 'text-primary-bright/70',
          ].join(' ')}
        >
          {stage.n}
        </span>
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 rounded-full',
            cyan
              ? 'bg-accent shadow-[0_0_10px_rgba(248,178,178,0.7)]'
              : 'bg-primary shadow-[0_0_10px_rgba(64,61,136,0.7)]',
          ].join(' ')}
        />
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
        {stage.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{stage.detail}</p>

      {/* Tiny schematic glyph per stage */}
      <svg
        aria-hidden="true"
        viewBox="0 0 64 28"
        className="mt-4 h-7 w-full text-muted/80"
        fill="none"
      >
        {stage.id === 'capture' && (
          <>
            <rect x="18" y="4" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="32" cy="14" r="5" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
          </>
        )}
        {stage.id === 'detect' && (
          <>
            {[
              [12, 18], [22, 10], [32, 8], [42, 12], [52, 16],
              [20, 20], [30, 16], [40, 18], [28, 22],
            ].map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.6"
                className={i % 2 ? 'fill-accent' : 'fill-primary'}
              />
            ))}
            <path
              d="M12 18 L22 10 L32 8 L42 12 L52 16 M22 10 L20 20 M32 8 L30 16 L28 22 M42 12 L40 18"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.55"
            />
          </>
        )}
        {stage.id === 'measure' && (
          <>
            <path d="M10 22 L26 6 L38 18 L54 8" stroke="currentColor" strokeWidth="1.5" className="text-primary-bright" />
            <path d="M10 22 H54" stroke="currentColor" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />
            <circle cx="26" cy="6" r="2" className="fill-accent" />
            <circle cx="38" cy="18" r="2" className="fill-primary" />
          </>
        )}
        {stage.id === 'score' && (
          <>
            {[0.9, 0.55, 0.75, 0.4, 0.85].map((h, i) => (
              <rect
                key={i}
                x={12 + i * 9}
                y={22 - h * 16}
                width="5"
                height={h * 16}
                rx="1"
                className={i % 2 ? 'fill-accent/80' : 'fill-primary/80'}
              />
            ))}
          </>
        )}
        {stage.id === 'coach' && (
          <>
            <rect x="10" y="6" width="44" height="8" rx="2" className="fill-accent/30 stroke-accent" strokeWidth="1" />
            <rect x="10" y="17" width="30" height="5" rx="1.5" className="fill-primary/25 stroke-primary" strokeWidth="1" />
          </>
        )}
      </svg>
    </div>
  )
}

function Branch({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-background/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-bright">
        {label}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  )
}
