import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { AuthControls } from './AuthControls'

const MODE_NAV = [
  { to: '/photo', label: 'Photo' },
  { to: '/video', label: 'Video' },
  { to: '/live', label: 'Live' },
] as const

const PUBLIC_NAV = [{ to: '/about', label: 'About' }] as const

function ModesDropdown() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const current = MODE_NAV.find((item) => location.pathname === item.to)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={[
          'inline-flex items-center gap-2 transition-colors duration-300 hover:text-white',
          current || open ? 'text-white' : '',
        ].join(' ')}
      >
        {current?.label ?? 'Modes'}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={[
            'h-2.5 w-2.5 fill-current transition-transform duration-300',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          <path d="M2.2 4.2 6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 min-w-36 border border-white/10 bg-black/95 py-1.5 backdrop-blur-sm"
        >
          {MODE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              className={({ isActive }) =>
                [
                  'block px-4 py-2.5 transition-colors duration-300 hover:bg-white/5 hover:text-white',
                  isActive ? 'text-white' : 'text-white/60',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const { user } = useAuth()
  const links = [
    ...(overlay ? [] : [{ to: '/', label: 'Home' }]),
    ...PUBLIC_NAV,
  ]

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
      <div className="flex flex-wrap items-center justify-end gap-4 font-body text-sm uppercase tracking-widest text-white/60 sm:gap-8">
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
        {user && <ModesDropdown />}
        <AuthControls />
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
