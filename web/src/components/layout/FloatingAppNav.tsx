import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const STORAGE_KEY = 'tt-app-nav-collapsed'

type NavItem = {
  to: string
  label: string
  adminOnly?: boolean
}

const APP_NAV: NavItem[] = [
  { to: '/progress', label: 'Progress' },
  { to: '/photo', label: 'Photo' },
  { to: '/video', label: 'Video' },
  { to: '/live', label: 'Live' },
  { to: '/admin', label: 'Admin', adminOnly: true },
]

function NavIcon({ item }: { item: NavItem }) {
  const className = 'h-4 w-4 shrink-0 stroke-current'
  switch (item.to) {
    case '/progress':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case '/photo':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="1" strokeWidth="1.5" />
          <circle cx="9" cy="10" r="2" strokeWidth="1.5" />
          <path d="m21 15-5-5-4 4-2-2-5 5" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case '/video':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="6" width="14" height="12" rx="1" strokeWidth="1.5" />
          <path d="m16 10 6-3v10l-6-3v-4Z" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )
    case '/live':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
          <path
            d="M12 5v1M12 18v1M5 12h1M18 12h1M7.05 7.05l.7.7M16.24 16.24l.7.7M7.05 16.95l.7-.7M16.24 7.76l.7-.7"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case '/admin':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3 4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return null
  }
}

export function FloatingAppNav() {
  const { user, isAdmin } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  if (!user) return null

  const items = APP_NAV.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside
      className={[
        'fixed left-4 top-1/2 z-30 -translate-y-1/2 font-body text-sm uppercase tracking-widest transition-[width] duration-300 ease-out',
        collapsed ? 'w-12' : 'w-44',
      ].join(' ')}
      aria-label="App navigation"
    >
      <div
        className={[
          'flex flex-col border border-white/10 bg-black/90 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md',
          collapsed ? 'items-center py-2' : 'py-2',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={[
            'flex items-center text-white/50 transition-colors hover:text-white',
            collapsed ? 'justify-center px-0 py-2' : 'justify-end px-2 py-1.5',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 12 12"
            className={[
              'h-3 w-3 fill-none stroke-current transition-transform duration-300',
              collapsed ? '' : 'rotate-180',
            ].join(' ')}
            aria-hidden="true"
          >
            <path d="M8 2 4 6l4 4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <nav className="flex flex-col gap-0.5 px-1.5 pb-1.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-sm transition-colors duration-300',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              <NavIcon item={item} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && (
                <span className="sr-only">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
