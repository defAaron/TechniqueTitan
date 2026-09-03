import type { CSSProperties, ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export const APP_NAV = [
  { to: '/photo', label: 'Photo' },
  { to: '/video', label: 'Video' },
  { to: '/live', label: 'Live' },
  { to: '/about', label: 'About' },
] as const

const footerLinks = [
  { href: 'https://github.com/defAaron/TechniqueTitan', label: 'GitHub', external: true },
  { href: 'https://www.youtube.com/watch?v=WdPEZ5SGXdc', label: 'YouTube', external: true },
  { href: '/about', label: 'About', external: false },
  { href: 'https://aarondutta.com', label: 'Website', external: true },
] as const

export function CinematicNav({
  overlay = false,
  style,
}: {
  overlay?: boolean
  style?: CSSProperties
}) {
  const links = overlay ? APP_NAV : [{ to: '/', label: 'Home' }, ...APP_NAV]

  return (
    <nav
      className={
        overlay
          ? 'absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8'
          : 'sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/80 px-6 py-6 backdrop-blur-sm sm:px-10'
      }
      style={style}
    >
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
      <div className="flex flex-wrap justify-end gap-4 font-body text-sm uppercase tracking-widest text-white/60 sm:gap-8">
        {links.map((item) =>
          overlay ? (
            <Link
              key={item.to}
              to={item.to}
              className="transition-colors duration-300 hover:text-white"
            >
              {item.label}
            </Link>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'transition-colors duration-300 hover:text-white',
                  isActive ? 'text-white' : '',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}

export function CinematicFooter() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 py-12 sm:px-10">
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
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="mb-10">
      <p className="mb-4 font-body text-sm uppercase tracking-[0.4em] text-white/40">
        {eyebrow}
      </p>
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
