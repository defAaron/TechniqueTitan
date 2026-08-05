import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/photo', label: 'Photo' },
  { to: '/video', label: 'Video' },
  { to: '/live', label: 'Live' },
  { to: '/about', label: 'About' },
]

const social = [
  {
    href: 'https://github.com/defAaron/TechniqueTitan',
    label: 'GitHub repository',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.486 2 12.02c0 4.427 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.621.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.02C22 6.486 17.523 2 12 2z" />
      </svg>
    ),
  },
  {
    href: 'https://www.youtube.com/watch?v=WdPEZ5SGXdc',
    label: 'YouTube demo',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden="true">
        <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.75 15.5v-7l6.5 3.5-6.5 3.5z" />
      </svg>
    ),
  },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <NavLink to="/" className="group flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg shadow-sm ring-1 ring-primary/30 transition-shadow group-hover:glow-cyan"
            />
            <span>
              <span className="block font-display text-lg font-bold tracking-tight text-foreground">
                Technique Titan
              </span>
              <span className="block text-xs text-muted">
                Your virtual piano technique coach, re-imagined
              </span>
            </span>
          </NavLink>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                        ? 'bg-primary text-foreground glow-blue'
                        : 'text-muted hover:bg-surface-raised hover:text-foreground',
                    ].join(' ')
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              {social.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/70 text-muted transition-all duration-200 hover:border-accent/50 hover:text-accent hover:glow-cyan"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="accent-line" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Technique Titan — computer vision for pianists.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/defAaron/TechniqueTitan"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-accent"
            >
              GitHub
            </a>
            <a
              href="https://www.youtube.com/watch?v=WdPEZ5SGXdc"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-accent"
            >
              YouTube demo
            </a>
            <p className="hidden sm:block">Landmarks stay on-device when possible.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
