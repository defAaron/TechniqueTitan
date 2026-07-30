const criteria = [
  'Wrist height',
  'Finger curvature',
  'Thumb position',
  'Wrist lateral deviation',
  'Overall hand arch',
]

export function AboutPage() {
  return (
    <article className="animate-fade-up max-w-2xl">
      <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-bright">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        Under the hood
      </p>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">
        About
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        Technique Titan detects hand landmarks, scores five piano posture criteria, and
        returns prioritized coaching. The scoring engine is Python (MediaPipe + geometry);
        this site is the React product UI.
      </p>

      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {criteria.map((label, i) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-foreground"
          >
            <span className="font-display text-sm font-bold tabular-nums text-accent/70">
              {String(i + 1).padStart(2, '0')}
            </span>
            {label}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-relaxed text-muted">
        Live mode prefers browser-side MediaPipe Hands and posts compact landmarks to the
        API so video stays on your device. Frame-upload mode is available as a fallback.
      </p>
    </article>
  )
}
