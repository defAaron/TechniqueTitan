const criteria = [
  'Wrist height',
  'Finger curvature',
  'Thumb position',
  'Wrist lateral deviation',
  'Overall hand arch',
]

const links = [
  {
    href: 'https://aarondutta.com',
    label: 'Website',
    detail: 'aarondutta.com',
  },
  {
    href: 'https://github.com/defAaron',
    label: 'GitHub',
    detail: 'github.com/defAaron',
  },
  {
    href: 'https://linkedin.com/in/aaron-dutta',
    label: 'LinkedIn',
    detail: 'linkedin.com/in/aaron-dutta',
  },
  {
    href: 'https://x.com/theaar0ndutta',
    label: 'X',
    detail: 'x.com/theaar0ndutta',
  },
  {
    href: 'https://youtube.com/@aaron_dutta',
    label: 'YouTube',
    detail: 'youtube.com/@aaron_dutta',
  },
]

export function AboutPage() {
  return (
    <article className="animate-fade-up max-w-2xl">
      <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-bright">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        Origin story
      </p>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground">
        About
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        Technique Titan started from a gap every serious pianist knows: you spend most of
        your hours practicing alone, but posture only gets corrected once a week — if you
        have a teacher at all.
      </p>

      <section aria-labelledby="inspiration-heading" className="mt-10">
        <h2
          id="inspiration-heading"
          className="font-display text-xl font-semibold text-foreground"
        >
          The inspiration
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            Good piano technique lives in small details — a wrist that stays level with the
            keys, fingers that hold a natural curve, a thumb that rests on its side instead of
            tucking under. Those habits decide speed, tone, and comfort. They also drift
            quietly. A collapsed wrist feels normal after a few days. By the time it hurts or
            a teacher catches it, the motion is already muscle memory.
          </p>
          <p>
            Lessons help, but they are infrequent. Between them, students reinforce whatever
            their hands already do. Self-taught players and remote learners often get no
            posture feedback at all. Mirrors and phone recordings only work if you know
            exactly what to look for, frame by frame — and you cannot watch your hands while
            you play.
          </p>
          <p>
            Technique Titan exists to close that loop. It turns an ordinary camera into a
            second pair of eyes: detect the hand, measure five posture criteria with
            geometry, score them consistently, and return the one coaching tip that matters
            most right now — no wearables, no special hardware, and (in live mode) landmarks
            that stay on your device.
          </p>
        </div>
      </section>

      <section aria-labelledby="creator-heading" className="mt-12">
        <h2
          id="creator-heading"
          className="font-display text-xl font-semibold text-foreground"
        >
          The creator
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            Technique Titan was built by{' '}
            <a
              href="https://aarondutta.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent transition-colors hover:text-primary-bright"
            >
              Aaron Dutta
            </a>
            , an award-winning pianist with fourteen years at the keys — including Royal
            Conservatory of Music Level 10 Piano with Honours — and a first-year Honours
            Mathematics student at the University of Waterloo.
          </p>
          <p>
            The project sits at the intersection of those two lives: the musician who knows
            how fragile healthy technique can be, and the builder exploring computer vision
            and agentic systems who wanted objective, on-demand coaching between lessons.
            What began as finger-and-wrist technique analysis research grew into the full
            detect → score → coach product you see here.
          </p>
        </div>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-all duration-200 hover:border-accent/50 hover:bg-surface-raised hover:glow-cyan"
              >
                <span className="text-sm font-semibold text-foreground">{link.label}</span>
                <span className="truncate text-xs text-muted transition-colors group-hover:text-accent">
                  {link.detail}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="scoring-heading" className="mt-12">
        <h2
          id="scoring-heading"
          className="font-display text-xl font-semibold text-foreground"
        >
          Under the hood
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Technique Titan detects hand landmarks, scores five piano posture criteria, and
          returns prioritized coaching. The scoring engine is Python (MediaPipe + geometry);
          this site is the React product UI.
        </p>

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
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

        <p className="mt-6 text-sm leading-relaxed text-muted">
          Live mode prefers browser-side MediaPipe Hands and posts compact landmarks to the
          API so video stays on your device. Frame-upload mode is available as a fallback.
        </p>
      </section>
    </article>
  )
}
