import { Link } from 'react-router-dom'
import { Hero } from '../components/Hero'
import { KeyFeatures } from '../components/KeyFeatures'
import { Reveal } from '../components/Reveal'

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
    <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-forest">
      <span
        aria-hidden="true"
        className="h-3 w-6 rounded-sm bg-[repeating-linear-gradient(90deg,var(--color-forest)_0_3px,transparent_3px_6px)]"
      />
      {children}
    </p>
  )
}

export function HomePage() {
  return (
    <div className="space-y-24 sm:space-y-32">
      <Hero />

      <Reveal as="section" aria-labelledby="problem-heading">
        <Eyebrow>The problem</Eyebrow>
        <h2
          id="problem-heading"
          className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
        >
          Technique drifts in the hours nobody is watching.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
          Posture faults are small, gradual, and invisible from the bench. They do
          not announce themselves until they cost you speed, tone, or comfort.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {problems.map((item, i) => (
            <Reveal
              key={item.title}
              delay={0.08 * i}
              className="relative overflow-hidden rounded-2xl border border-stone-300/70 bg-white/60 p-5"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-warn/70 to-transparent"
              />
              <h3 className="font-display text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="solution-heading">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Eyebrow>The solution</Eyebrow>
            <h2
              id="solution-heading"
              className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
            >
              A second pair of eyes on every practice session.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">
              Technique Titan turns an ordinary camera into a posture instrument. It
              measures the same five things a teacher watches for, scores them
              consistently, and hands back the one correction that matters most right
              now — no wearables, no special hardware.
            </p>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-muted">
              Live mode prefers browser-side landmark detection and posts only compact
              landmarks to the API, so your video stays on your device.
            </p>
          </div>
          <Reveal
            direction="right"
            delay={0.1}
            className="rounded-3xl border border-forest/20 bg-gradient-to-br from-forest/[0.08] to-white/50 p-6 sm:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">
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
                  className="flex items-center gap-3 border-b border-stone-300/50 pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-display text-sm font-bold tabular-nums text-forest/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium text-ink">{label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="how-heading">
        <Eyebrow>How it works</Eyebrow>
        <h2
          id="how-heading"
          className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
        >
          Four steps, start to coaching.
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal
              as="li"
              key={step.n}
              delay={0.08 * i}
              className="relative rounded-2xl border border-stone-300/70 bg-white/60 p-5"
            >
              <span className="font-display text-3xl font-bold tabular-nums text-forest/25">
                {step.n}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-forest">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Reveal>

      <Reveal as="section" aria-labelledby="features-heading">
        <Eyebrow>Key features</Eyebrow>
        <h2
          id="features-heading"
          className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
        >
          Five criteria, measured the same way every time.
        </h2>
        <div className="mt-10">
          <KeyFeatures />
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="modes-heading">
        <Eyebrow>Start practicing</Eyebrow>
        <h2
          id="modes-heading"
          className="mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl"
        >
          Pick the mode that fits your session.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {cards.map((card, i) => (
            <Reveal key={card.to} delay={0.08 * i}>
              <Link
                to={card.to}
                className="group flex h-full flex-col rounded-2xl border border-stone-300/70 bg-white/65 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-forest/40 hover:bg-white hover:shadow-md"
              >
                <h3 className="font-display text-xl font-semibold text-forest">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{card.body}</p>
                <span
                  aria-hidden="true"
                  className="mt-4 text-sm font-semibold text-forest transition-transform group-hover:translate-x-0.5"
                >
                  Open →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
