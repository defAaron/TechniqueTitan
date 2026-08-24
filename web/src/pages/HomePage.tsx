import { Link } from 'react-router-dom'
import { Hero, KeyFeatures, PipelineFlow, VideoPreview } from '../components/marketing'
import { Reveal } from '../components/ui'

const cards = [
  {
    to: '/photo',
    title: 'Photo review',
    body: 'Upload a single still of your hand on the keys for per-criterion scores and coaching.',
  },
  {
    to: '/video',
    title: 'Video timeline',
    body: 'Analyze a short practice clip and see how posture holds up over time.',
  },
  {
    to: '/live',
    title: 'Live practice',
    body: 'Use your browser camera for real-time feedback while you play.',
  },
]

const problems = [
  {
    title: 'Bad habits set in quietly',
    body: 'A wrist that drops below the keys feels normal after a week. By the time it hurts, it is muscle memory.',
  },
  {
    title: 'Feedback arrives once a week',
    body: 'Your teacher catches it at the lesson. The other six days of practice reinforce whatever your hand was already doing.',
  },
  {
    title: 'You cannot watch your hands and play',
    body: 'Mirrors and phone recordings only help if you know exactly what to look for, frame by frame.',
  },
]

const steps = [
  {
    n: '01',
    title: 'Capture',
    body: 'Bring a still photo, a short practice clip, or your live browser camera — whichever fits the moment.',
  },
  {
    n: '02',
    title: 'Detect',
    body: 'MediaPipe locates the 21 hand landmarks, and geometry turns those points into measurable angles and distances.',
  },
  {
    n: '03',
    title: 'Score',
    body: 'Each of the five criteria is scored and banded — good, warning, or critical — so problems are visible at a glance.',
  },
  {
    n: '04',
    title: 'Coach',
    body: 'Tips come back prioritized and in plain language, so you know which single thing to fix first.',
  },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-bright">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </p>
  )
}

function Divider({ blue = false }: { blue?: boolean }) {
  return (
    <div aria-hidden="true" className={`accent-line ${blue ? 'accent-line--blue' : ''}`} />
  )
}

export function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-24">
      <Hero />

      <VideoPreview />

      <Divider blue />

      <Reveal as="section" aria-labelledby="problem-heading">
        <Eyebrow>The problem</Eyebrow>
        <h2
          id="problem-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
        >
          Technique drifts in the hours nobody is watching.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Posture faults are small, gradual, and invisible from the bench. They do
          not announce themselves until they cost you speed, tone, or comfort.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {problems.map((item, i) => (
            <Reveal
              key={item.title}
              delay={0.08 * i}
              className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:border-warn/50"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-warn/80 to-transparent"
              />
              <h3 className="font-display text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Divider blue />

      <Reveal as="section" aria-labelledby="solution-heading">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Eyebrow>The solution</Eyebrow>
            <h2
              id="solution-heading"
              className="mt-5 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
            >
              A second pair of eyes on every practice session.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
              Technique Titan turns an ordinary camera into a posture instrument. It
              measures the same five things a teacher watches for, scores them
              consistently, and hands back the one correction that matters most right
              now — no wearables, no special hardware.
            </p>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
              Live mode prefers browser-side landmark detection and posts only compact
              landmarks to the API, so your video stays on your device.
            </p>
          </div>
          <Reveal
            direction="right"
            delay={0.1}
            className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-surface to-surface p-6 glow-blue sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Scored every frame
            </p>
            <ul className="mt-5 space-y-3">
              {[
                'Wrist height',
                'Finger curvature',
                'Thumb position',
                'Wrist lateral deviation',
                'Overall hand arch',
              ].map((label, i) => (
                <li
                  key={label}
                  className="flex items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-display text-sm font-bold tabular-nums text-accent/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Reveal>

      <Divider />

      <Reveal as="section" aria-labelledby="how-heading">
        <Eyebrow>How it works</Eyebrow>
        <h2
          id="how-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
        >
          Four steps, start to coaching.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Capture in, coaching out — here is the full processing workflow from a camera frame
          to a prioritized tip.
        </p>
        <div className="mt-10">
          <PipelineFlow />
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal
              as="li"
              key={step.n}
              delay={0.08 * i}
              className="group relative rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:border-primary/50 hover:glow-blue"
            >
              <span className="font-display text-3xl font-bold tabular-nums text-primary/40 transition-colors group-hover:text-primary/70">
                {step.n}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-accent">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Reveal>

      <Divider blue />

      <Reveal as="section" aria-labelledby="features-heading">
        <Eyebrow>Key features</Eyebrow>
        <h2
          id="features-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
        >
          Five criteria, measured the same way every time.
        </h2>
        <div className="mt-10">
          <KeyFeatures />
        </div>
      </Reveal>

      <Divider />

      <Reveal as="section" aria-labelledby="modes-heading">
        <Eyebrow>Start practicing</Eyebrow>
        <h2
          id="modes-heading"
          className="mt-5 max-w-2xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
        >
          Pick the mode that fits your session.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((card, i) => (
            <Reveal key={card.to} delay={0.08 * i}>
              <Link
                to={card.to}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-raised hover:glow-cyan"
              >
                <h3 className="font-display text-xl font-semibold text-accent">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
                <span
                  aria-hidden="true"
                  className="mt-4 text-sm font-semibold text-foreground transition-transform group-hover:translate-x-0.5"
                >
                  Open →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal
        as="section"
        aria-labelledby="cta-heading"
        className="tech-grid relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/[0.12] to-surface px-6 py-14 text-center sm:px-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
        <h2
          id="cta-heading"
          className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl"
        >
          Ready to see what your hands are actually doing?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          Start with a single photo. No account, no installation, no special hardware —
          just the camera you already have.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/photo"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-primary-bright hover:glow-blue"
          >
            Analyze a photo
          </Link>
          <Link
            to="/about"
            className="rounded-full border border-accent/40 bg-accent/5 px-6 py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:border-accent hover:bg-accent/15"
          >
            How the scoring works
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
