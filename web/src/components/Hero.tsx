import { Link, useNavigate } from 'react-router-dom'
import SpecularButton from './SpecularButton'

const stats = [
  { value: '5', label: 'Posture criteria scored' },
  { value: '21', label: 'Hand landmarks tracked' },
  { value: 'Real-time', label: 'Feedback while you play' },
]

/**
 * Hero stage: full-bleed piano hands still behind the headline, with
 * scroll-driven parallax on the background image (see .hero-parallax in index.css).
 */
export function Hero() {
  const navigate = useNavigate()

  return (
    <section className="hero-parallax relative isolate overflow-hidden bg-background">
      <div className="hero-parallax__media" aria-hidden="true">
        <img
          className="hero-parallax__img"
          src="/hero-piano.jpg"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </div>

      {/* Scrims: darken the image enough for text contrast and tint it toward the brand blue. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-background via-background/85 to-background/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_65%_60%_at_18%_25%,rgba(74,92,255,0.4),transparent_70%)]"
      />
      <div aria-hidden="true" className="tech-grid pointer-events-none absolute inset-0 z-[1] opacity-60" />

      {/* Signal bars bleeding in from the edges. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/4 z-[1] h-32 w-px bg-gradient-to-b from-accent to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1/4 right-0 z-[1] h-32 w-px bg-gradient-to-t from-primary-bright to-transparent"
      />

      <div className="hero-parallax__content relative z-[2] mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:py-32">
        <div className="max-w-2xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
            Computer vision for pianists
          </p>

          <h1 className="font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            Catch collapsed wrists{' '}
            <span className="text-gradient">before they become habit.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
            Technique Titan measures five posture criteria from a standard camera —
            wrist height, finger curve, thumb, lateral bend, and hand arch — then
            returns plain-language coaching.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <SpecularButton
              size="lg"
              radius={18}
              tint="#4a5cff"
              tintOpacity={0.18}
              blur={8}
              textColor="#f2f4f8"
              lineColor="#22d3ee"
              baseColor="#4a5cff"
              intensity={1}
              shineSize={10}
              shineFade={40}
              thickness={1}
              speed={0.35}
              followMouse
              proximity={250}
              autoAnimate={false}
              onClick={() => navigate('/photo')}
            >
              Start analysis
            </SpecularButton>
            <Link
              to="/live"
              className="rounded-full border border-accent/40 bg-accent/5 px-5 py-2.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-all duration-200 hover:border-accent hover:bg-accent/15 hover:glow-cyan"
            >
              Try live camera
            </Link>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-line bg-surface/60 px-4 py-3 backdrop-blur-sm"
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block font-display text-xl font-bold text-accent sm:text-2xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Keybed motif along the bottom edge, echoing the instrument. */}
      <div aria-hidden="true" className="keybed absolute inset-x-0 bottom-0 z-[2] h-1.5 opacity-70" />
    </section>
  )
}
