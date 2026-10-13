import { type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AuthControls } from './AuthControls'

const footerLinks = [
  { href: 'https://github.com/defAaron/TechniqueTitan', label: 'GitHub', external: true },
  { href: 'https://www.youtube.com/watch?v=WdPEZ5SGXdc', label: 'YouTube', external: true },
  { href: '/about', label: 'About', external: false },
  { href: 'https://aarondutta.com', label: 'Website', external: true },
] as const

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
  const navClass = fixed
    ? 'flex items-center justify-between border-b border-white/10 bg-black px-6 py-5 backdrop-blur-md sm:px-10'
    : overlay
      ? 'absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8'
      : 'sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/80 px-6 py-6 backdrop-blur-sm sm:px-10'

  return (
    <nav className={navClass} style={style}>
      <Link
        to="/"
        className="flex items-center gap-3 font-body text-sm font-light uppercase tracking-[0.3em] text-white"
      >
        {!overlay && (
          <img
            src="/icon-192.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 ring-1 ring-white/25"
          />
        )}
        Technique Titan
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
        'border-t border-white/10 px-6 py-12 sm:px-10',
        onLanding ? 'bg-zinc-950' : 'bg-black',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <p className="font-body text-sm uppercase tracking-[0.4em] text-white/30">
          © {new Date().getFullYear()} Technique Titan
        </p>
        <div className="flex flex-wrap gap-8">
          {footerLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="font-body text-sm uppercase tracking-widest text-white/30 transition-colors duration-300 hover:text-white/70"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className="font-body text-sm uppercase tracking-widest text-white/30 transition-colors duration-300 hover:text-white/70"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </div>
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
