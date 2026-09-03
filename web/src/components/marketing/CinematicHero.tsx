import { useEffect, useRef, useState } from 'react'
import { CinematicNav } from '../layout'

const CLOSE_UP_IMG = '/landing/keys-close.jpg'
const PIANIST_IMG = '/landing/pianist.jpg'

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Sticky 500vh hero from the Figma Make “Piano Performance Landing Page”.
 * Phase 1 zooms the close-up out of a tilted extreme; phase 2 crossfades
 * to the hall shot and reveals the title.
 */
export function CinematicHero() {
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  const [scrollProgress, setScrollProgress] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : 0,
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const apply = () => {
      const reduced = Boolean(mq?.matches)
      setReduceMotion(reduced)
      if (reduced) setScrollProgress(1)
    }
    apply()
    mq?.addEventListener('change', apply)
    return () => mq?.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (reduceMotion) return

    const onScroll = () => {
      const el = scrollRef.current
      if (!el) return
      const totalScrollable = el.offsetHeight - window.innerHeight
      const scrolled = -el.getBoundingClientRect().top
      const progress =
        totalScrollable <= 0 ? 1 : Math.min(Math.max(scrolled / totalScrollable, 0), 1)
      setScrollProgress(progress)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduceMotion])

  const phase1 = Math.min(scrollProgress / 0.55, 1)
  const phase2 = Math.max((scrollProgress - 0.55) / 0.45, 0)

  const easedP1 = easeInOutCubic(phase1)
  const easedP2 = easeInOutCubic(phase2)

  const closeScale = lerp(2.8, 1.05, easedP1)
  const closeRotateX = lerp(32, 0, easedP1)
  const closePerspective = lerp(800, 2000, easedP1)
  const closeOpacity = phase2 > 0.3 ? lerp(1, 0, (phase2 - 0.3) / 0.7) : 1

  const wideOpacity = easedP2
  const wideScale = lerp(1.4, 1.0, easedP2)

  const heroOpacity = phase2 > 0.5 ? (phase2 - 0.5) / 0.5 : 0
  const heroY = lerp(80, 0, Math.max((phase2 - 0.5) / 0.5, 0))

  const letterboxHeight = lerp(80, 0, Math.min(scrollProgress * 2, 1))
  const vignetteOpacity = lerp(0.85, 0.5, easedP1)
  const scrollHintOpacity = scrollProgress < 0.08 ? 1 - scrollProgress / 0.08 : 0

  return (
    <div ref={scrollRef} style={{ height: reduceMotion ? '100vh' : '500vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-black">
        <div className="absolute inset-0" style={{ perspective: `${closePerspective}px` }}>
          <img
            src={CLOSE_UP_IMG}
            alt=""
            width={2400}
            height={1600}
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{
              transform: `scale(${closeScale}) rotateX(${closeRotateX}deg)`,
              opacity: closeOpacity,
              transformOrigin: '50% 75%',
              transition: 'none',
              willChange: 'transform, opacity',
            }}
          />
        </div>

        <div className="absolute inset-0">
          <img
            src={PIANIST_IMG}
            alt=""
            width={2400}
            height={1600}
            className="absolute inset-0 h-full w-full object-cover object-center"
            style={{
              opacity: wideOpacity,
              transform: `scale(${wideScale})`,
              transformOrigin: '50% 50%',
              transition: 'none',
              willChange: 'transform, opacity',
            }}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: vignetteOpacity,
            background:
              'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.95) 100%)',
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.7) 100%)',
          }}
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 bg-black"
          style={{ height: `${letterboxHeight}px`, transition: 'none' }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-black"
          style={{ height: `${letterboxHeight}px`, transition: 'none' }}
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: '180px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            opacity: 1 - easedP1 * 0.5,
          }}
        />

        <CinematicNav overlay style={{ opacity: lerp(1, 0.4, easedP2) }} />

        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ opacity: 1 - easedP2 }}
        >
          <div className="px-6 text-center sm:px-10">
            <p
              className="mb-6 font-body font-semibold uppercase text-white/80"
              style={{
                fontSize: 'clamp(1.15rem, 2.6vw, 2rem)',
                letterSpacing: '0.22em',
                lineHeight: 1.45,
              }}
            >
              Your AI virtual piano teacher
            </p>
            <div className="landing-shimmer mx-auto h-16 w-px bg-white/20" />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center pb-16"
          style={{
            opacity: heroOpacity,
            transform: `translateY(${heroY}px)`,
            transition: 'none',
          }}
        >
          <p className="mb-5 font-body text-sm uppercase tracking-[0.5em] text-white/50">
            Virtual coach
          </p>
          <h1
            className="mb-6 max-w-4xl text-center font-cinematic font-normal leading-[1.05] text-white"
            style={{
              fontSize: 'clamp(2.4rem, 6.2vw, 5.5rem)',
              letterSpacing: '-0.01em',
            }}
          >
            Catch bad technique
            <br />
            <em className="font-light italic">before it becomes a habit</em>
          </h1>
          <div className="flex items-center gap-6">
            <div className="h-px w-16 bg-white/30" />
            <p className="font-body text-sm uppercase tracking-[0.4em] text-white/60">
              Technique Titan — Piano
            </p>
            <div className="h-px w-16 bg-white/30" />
          </div>
          <a
            href="#criteria"
            className="mt-10 border border-white/30 px-8 py-3 font-body text-sm uppercase tracking-[0.3em] text-white/80 transition-all duration-500 hover:border-white hover:text-white"
            style={{ pointerEvents: heroOpacity > 0.4 ? 'auto' : 'none' }}
          >
            Discover
          </a>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-3"
          style={{ opacity: scrollHintOpacity }}
        >
          <span className="font-body text-sm uppercase tracking-[0.4em] text-white/40">
            Scroll
          </span>
          <div className="h-12 w-px bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>
    </div>
  )
}
