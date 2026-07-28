import { Link } from 'react-router-dom'

/**
 * Hero stage: piano hands still behind the headline, with scroll-driven
 * parallax on the background image (see .hero-parallax in index.css).
 */
export function Hero() {
  return (
    <section className="hero-parallax relative isolate overflow-hidden rounded-[2rem] border border-ink/10 bg-ink shadow-[0_24px_70px_-30px_rgba(28,25,23,0.55)]">
      <div className="hero-parallax__media" aria-hidden="true">
        <img
          className="hero-parallax__img"
          src="/hero-piano.jpg"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </div>

      {/* Scrims: darken the image enough for text contrast and tint it toward the brand green. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-ink/92 via-ink/70 to-ink/25"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_70%_60%_at_15%_20%,rgba(31,92,69,0.45),transparent_70%)]"
      />

      <div className="hero-parallax__content relative z-[2] px-6 py-20 sm:px-10 sm:py-24 lg:px-14 lg:py-32">
        <div className="max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-paper/25 bg-paper/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-paper/85 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-forest-bright" />
            Piano posture, measured
          </p>

          <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-paper sm:text-5xl lg:text-6xl">
            Catch collapsed wrists before they become habit.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-paper/80 sm:text-lg">
            Technique Titan measures five posture criteria from a standard camera —
            wrist height, finger curve, thumb, lateral bend, and hand arch — then
            returns plain-language coaching.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/photo"
              className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-forest-bright"
            >
              Analyze a photo
            </Link>
            <Link
              to="/live"
              className="rounded-full border border-paper/35 bg-paper/10 px-5 py-2.5 text-sm font-semibold text-paper backdrop-blur-sm transition hover:bg-paper/20"
            >
              Try live camera
            </Link>
          </div>
        </div>
      </div>

      {/* Keybed motif along the bottom edge, echoing the instrument. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 z-[2] h-1.5 bg-[repeating-linear-gradient(90deg,rgba(247,244,239,0.85)_0_14px,rgba(28,25,23,0.9)_14px_18px)]"
      />
    </section>
  )
}
