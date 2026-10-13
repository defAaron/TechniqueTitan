import { type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthControls } from './AuthControls'

export function CinematicNav({
  overlay = false,
  fixed = false,
  style,
}: {
  overlay?: boolean
  /** Pin to viewport top (used on the marketing home). */
  fixed?: boolean
  style?: CSSProperties
}) {
  const location = useLocation()
  const navClass = fixed
    ? 'flex items-center justify-between border-b border-white/10 bg-black px-6 py-2.5 backdrop-blur-md sm:px-10'
    : overlay
      ? 'absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-4 sm:px-10 sm:pt-5'
      : 'sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/80 px-6 py-2.5 backdrop-blur-sm sm:px-10'

  return (
    <nav className={navClass} style={style}>
      <Link
        to="/"
        aria-label="Technique Titan"
        className="flex items-center"
        onClick={() => {
          if (location.pathname === '/') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
      >
        <img
          src="/icon-192.png"
          alt=""
            width={24}
            height={24}
            className={
              overlay
              ? 'h-6 w-6'
              : 'h-6 w-6 ring-1 ring-white/25'
            }
        />
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-4 font-body text-sm uppercase tracking-widest text-white/60 sm:gap-8">
        <AuthControls />
      </div>
    </nav>
  )
}

export function CinematicFooter({ onLanding = false }: { onLanding?: boolean }) {
  return (
    <footer
      className={[
        'border-t border-white/10 px-6 py-3 sm:px-10',
        onLanding ? 'bg-zinc-950' : 'bg-black',
      ].join(' ')}
    >
      <p className="mx-auto max-w-6xl font-body text-xs uppercase tracking-[0.35em] text-white/30">
        © {new Date().getFullYear()} Technique Titan
      </p>
    </footer>
  )
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="mb-10">
      {eyebrow ? (
        <p className="mb-4 font-body text-sm uppercase tracking-[0.4em] text-white/40">
          {eyebrow}
        </p>
      ) : null}
      <h1
        className="font-cinematic font-normal leading-tight text-white"
        style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
      >
        {title}
      </h1>
      {children && (
        <p className="mt-4 max-w-xl font-body text-base font-light leading-relaxed text-white/50">
          {children}
        </p>
      )}
    </header>
  )
}
