import { Link } from 'react-router-dom'
import { CinematicFooter } from '../components/layout'
import { CinematicHero } from '../components/marketing'
import { CRITERION_LABELS } from '../lib/api'

const CLOSE_UP_IMG = '/landing/keys-close.jpg'
const WIDE_IMG = '/landing/keys-wide.jpg'
const PIANIST_IMG = '/landing/pianist.jpg'

const criteria = [
  {
    n: '01',
    key: 'wrist_height',
    body: 'Where your wrist sits relative to the knuckle line.',
  },
  {
    n: '02',
    key: 'finger_curvature',
    body: 'How much curve each long finger holds on the key.',
  },
  {
    n: '03',
    key: 'thumb_position',
    body: 'How far the thumb sits from the rest of the hand.',
  },
  {
    n: '04',
    key: 'wrist_lateral',
    body: 'Sideways bend of the wrist against the forearm.',
  },
  {
    n: '05',
    key: 'hand_arch',
    body: 'The height of the arch across your knuckle bridge.',
  },
] as const

const modes = [
  {
    to: '/photo',
    title: 'Photo review',
    meta: 'Still frame · seconds',
    img: CLOSE_UP_IMG,
    alt: 'Close-up of piano keys',
  },
  {
    to: '/video',
    title: 'Video timeline',
    meta: 'Practice clip · over time',
    img: WIDE_IMG,
    alt: 'Piano keyboard in warm light',
  },
  {
    to: '/live',
    title: 'Live practice',
    meta: 'Browser camera · real-time',
    img: PIANIST_IMG,
    alt: 'Grand piano on a concert stage',
  },
]

export function HomePage() {
  return (
    <div className="bg-black">
      <CinematicHero />

      <section
        id="criteria"
        className="mx-auto max-w-6xl bg-black px-6 pb-24 pt-32 text-white sm:px-10"
      >
        <div className="mb-24 grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="hidden pt-2 lg:col-span-1 lg:block">
            <span className="landing-vert font-body text-sm uppercase tracking-widest text-white/30">
              01
            </span>
          </div>
          <div className="lg:col-span-5">
            <p className="mb-6 font-body text-sm uppercase tracking-[0.4em] text-white/40">
              Scoring
            </p>
            <h2
              className="mb-8 font-cinematic font-normal leading-tight text-white"
              style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
            >
              Five
              <br />
              <em className="italic text-white/60">Criteria</em>
            </h2>
            <p className="max-w-sm font-body text-base font-light leading-relaxed text-white/50">
              An ordinary camera, 21 hand landmarks, and the same five checks a teacher
              watches for — scored good, warning, or critical on every frame.
            </p>
          </div>
          <div className="lg:col-span-6">
            <div>
              {criteria.map((item) => (
                <Link
                  key={item.key}
                  to="/about"
                  className="group flex cursor-pointer items-center gap-6 border-b border-white/10 py-5 transition-colors duration-300 hover:border-white/30"
                >
                  <span className="w-12 flex-shrink-0 font-body text-sm text-white/30">
                    {item.n}
                  </span>
                  <div className="flex-1">
                    <p className="font-cinematic text-base text-white transition-colors group-hover:text-white/80">
                      {CRITERION_LABELS[item.key]}
                    </p>
                    <p className="mt-0.5 font-body text-sm text-white/40">{item.body}</p>
                  </div>
                  <span className="text-sm text-white/20 transition-colors group-hover:text-white/60">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-24 flex items-center gap-8">
          <div className="h-px flex-1 bg-white/10" />
          <blockquote
            className="max-w-md text-center font-cinematic text-white/50 italic"
            style={{ fontSize: '1.25rem', lineHeight: 1.7 }}
          >
            Technique drifts in the hours nobody is watching.
          </blockquote>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden bg-zinc-900" style={{ aspectRatio: '4/5' }}>
              <img
                src={WIDE_IMG}
                alt="Piano keyboard detail in moody light"
                width={2400}
                height={1600}
                className="h-full w-full object-cover"
                style={{ filter: 'grayscale(20%) contrast(1.1)' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                }}
              />
            </div>
          </div>
          <div className="hidden lg:col-span-1 lg:block" />
          <div className="lg:col-span-6">
            <p className="mb-6 font-body text-sm uppercase tracking-[0.4em] text-white/30">
              About
            </p>
            <h3
              className="mb-6 font-cinematic font-normal text-white"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}
            >
              Technique Titan
            </h3>
            <p className="mb-4 font-body text-base font-light leading-relaxed text-white/50">
              A second pair of eyes on every practice session. It measures wrist height,
              finger curvature, thumb position, wrist line, and hand arch — then returns
              the one correction that matters most right now.
            </p>
            <p className="mb-10 font-body text-base font-light leading-relaxed text-white/40">
              No account, no wearables, no special hardware. Live mode keeps video on your
              device and posts only compact landmarks to the API.
            </p>
            <Link
              to="/about"
              className="border-b border-white/20 pb-1 font-body text-sm uppercase tracking-[0.4em] text-white/60 transition-all duration-300 hover:border-white hover:text-white"
            >
              How scoring works
            </Link>
          </div>
        </div>
      </section>

      <section id="start" className="border-t border-white/10 bg-black px-6 py-24 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {modes.map((mode) => (
              <Link key={mode.to} to={mode.to} className="group" aria-label={mode.title}>
                <div className="mb-4 overflow-hidden bg-zinc-900" style={{ aspectRatio: '1/1' }}>
                  <img
                    src={mode.img}
                    alt={mode.alt}
                    width={2400}
                    height={1600}
                    className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
                  />
                </div>
                <p className="mb-1 font-cinematic text-base text-white">{mode.title}</p>
                <p className="font-body text-sm text-white/40">{mode.meta}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CinematicFooter />
    </div>
  )
}
