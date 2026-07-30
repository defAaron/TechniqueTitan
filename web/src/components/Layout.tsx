import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/photo', label: 'Photo' },
  { to: '/video', label: 'Video' },
  { to: '/live', label: 'Live' },
  { to: '/about', label: 'About' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <NavLink to="/" className="group flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-lg border border-primary/40 bg-primary/10 font-display text-sm font-bold text-accent transition-shadow group-hover:glow-cyan"
            >
              TT
            </span>
            <span>
              <span className="block font-display text-lg font-bold tracking-tight text-foreground">
                Technique Titan
              </span>
              <span className="block text-xs text-muted">
                Piano posture analysis, measured
              </span>
            </span>
          </NavLink>
          <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-surface/70 p-1 backdrop-blur-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary text-foreground shadow-[0_0_18px_rgba(74,92,255,0.45)]'
                      : 'text-muted hover:bg-surface-raised hover:text-foreground',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div aria-hidden="true" className="accent-line" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-clip px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Technique Titan — computer vision for pianists.</p>
          <p>
            Landmark detection runs in your browser; only compact coordinates reach the
            API.
          </p>
        </div>
      </footer>
    </div>
  )
}
