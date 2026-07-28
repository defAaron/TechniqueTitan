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
      <header className="sticky top-0 z-40 border-b border-stone-300/50 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-3xl font-bold tracking-tight text-forest sm:text-4xl">
              Technique Titan
            </p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              Piano hand posture analysis — photo, video, or live camera.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1 rounded-full border border-stone-300/70 bg-white/60 p-1 shadow-sm backdrop-blur-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-forest text-paper shadow-sm'
                      : 'text-ink-muted hover:bg-stone-200/70 hover:text-ink',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div aria-hidden="true" className="keybed h-1 opacity-40" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>

      <footer className="border-t border-stone-300/60 bg-paper/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-muted sm:px-6">
          Interim Streamlit demo may still be available separately. This React app is
          the product UI.
        </div>
      </footer>
    </div>
  )
}
