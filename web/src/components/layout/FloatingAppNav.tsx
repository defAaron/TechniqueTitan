import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const PIN_STORAGE_KEY = 'tt-app-nav-collapsed'
const DOCK_STORAGE_KEY = 'tt-app-nav-dock'

const EDGE_INSET = 16
const VIEW_MARGIN = 12

type DockEdge = 'left' | 'right' | 'top' | 'bottom'

type DockState = {
  edge: DockEdge
  /** 0–1 position along the edge (from top on left/right, from left on top/bottom). */
  offset: number
}

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

function isVerticalEdge(edge: DockEdge): boolean {
  return edge === 'left' || edge === 'right'
}

function readDockState(): DockState {
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY)
    if (!raw) return { edge: 'left', offset: 0.5 }
    const parsed = JSON.parse(raw) as Partial<DockState>
    const edge = parsed.edge
    const offset = typeof parsed.offset === 'number' ? parsed.offset : 0.5
    if (edge === 'left' || edge === 'right' || edge === 'top' || edge === 'bottom') {
      return { edge, offset: Math.min(1, Math.max(0, offset)) }
    }
  } catch {
    /* ignore */
  }
  return { edge: 'left', offset: 0.5 }
}

function snapDock(centerX: number, centerY: number, width: number, height: number): DockState {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const distances = [
    { edge: 'left' as const, value: centerX },
    { edge: 'right' as const, value: vw - centerX },
    { edge: 'top' as const, value: centerY },
    { edge: 'bottom' as const, value: vh - centerY },
  ]
  distances.sort((a, b) => a.value - b.value)
  const edge = distances[0].edge

  if (isVerticalEdge(edge)) {
    const travel = Math.max(1, vh - height - VIEW_MARGIN * 2)
    const top = Math.min(Math.max(centerY - height / 2, VIEW_MARGIN), vh - height - VIEW_MARGIN)
    return { edge, offset: (top - VIEW_MARGIN) / travel }
  }

  const travel = Math.max(1, vw - width - VIEW_MARGIN * 2)
  const left = Math.min(Math.max(centerX - width / 2, VIEW_MARGIN), vw - width - VIEW_MARGIN)
  return { edge, offset: (left - VIEW_MARGIN) / travel }
}

function dockToStyle(
  dock: DockState,
  width: number,
  height: number,
): { style: CSSProperties; vertical: boolean } {
  const vertical = isVerticalEdge(dock.edge)
  const vh = window.innerHeight
  const vw = window.innerWidth

  if (vertical) {
    const travel = Math.max(0, vh - height - VIEW_MARGIN * 2)
    const top = VIEW_MARGIN + dock.offset * travel
    if (dock.edge === 'left') {
      return {
        vertical: true,
        style: { position: 'fixed', left: EDGE_INSET, top, zIndex: 30 },
      }
    }
    return {
      vertical: true,
      style: { position: 'fixed', right: EDGE_INSET, top, zIndex: 30 },
    }
  }

  const travel = Math.max(0, vw - width - VIEW_MARGIN * 2)
  const left = VIEW_MARGIN + dock.offset * travel
  if (dock.edge === 'top') {
    return {
      vertical: false,
      style: { position: 'fixed', left, top: EDGE_INSET, zIndex: 30 },
    }
  }
  return {
    vertical: false,
    style: { position: 'fixed', left, bottom: EDGE_INSET, zIndex: 30 },
  }
}

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

function DragGrip({ vertical }: { vertical: boolean }) {
  return (
    <div
      className={[
        'grid shrink-0 cursor-grab grid-cols-2 gap-[3px] rounded-sm p-1.5 touch-none active:cursor-grabbing',
        vertical ? 'mx-auto' : '',
      ].join(' ')}
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-white/40" />
      ))}
    </div>
  )
}

export function FloatingAppNav() {
  const { user, isAdmin } = useAuth()
  const asideRef = useRef<HTMLElement>(null)
  const [pinnedOpen, setPinnedOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(PIN_STORAGE_KEY)
      if (stored === null) return false
      return stored !== '1'
    } catch {
      return false
    }
  })
  const [hovered, setHovered] = useState(false)
  const [dock, setDock] = useState<DockState>(readDockState)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 48, height: 200 })

  const expanded = hovered || pinnedOpen
  const dragging = dragPoint !== null
  const vertical = isVerticalEdge(dock.edge)

  const measure = useCallback(() => {
    const el = asideRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setSize({ width: rect.width, height: rect.height })
    }
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure, expanded, dock.edge, vertical])

  useEffect(() => {
    const el = asideRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, pinnedOpen ? '0' : '1')
    } catch {
      /* ignore */
    }
  }, [pinnedOpen])

  useEffect(() => {
    if (dragging) return
    try {
      localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(dock))
    } catch {
      /* ignore */
    }
  }, [dock, dragging])

  useEffect(() => {
    function onResize() {
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [measure])

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const width = asideRef.current?.offsetWidth ?? size.width
      const height = asideRef.current?.offsetHeight ?? size.height
      setDock(snapDock(clientX, clientY, width, height))
      setDragPoint(null)
    },
    [size.height, size.width],
  )

  useEffect(() => {
    if (!dragPoint) return

    function onMove(event: PointerEvent) {
      setDragPoint({ x: event.clientX, y: event.clientY })
    }
    function onUp(event: PointerEvent) {
      finishDrag(event.clientX, event.clientY)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragPoint, finishDrag])

  function onGripPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    setHovered(true)
    setDragPoint({ x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  if (!user) return null

  const items = APP_NAV.filter((item) => !item.adminOnly || isAdmin)

  const docked = dockToStyle(dock, size.width, size.height)
  const asideStyle: CSSProperties = dragging
    ? {
        position: 'fixed',
        left: dragPoint.x - size.width / 2,
        top: dragPoint.y - size.height / 2,
        zIndex: 50,
      }
    : docked.style

  const panelVertical = dragging ? vertical : docked.vertical

  return (
    <aside
      ref={asideRef}
      className={[
        'font-body text-sm uppercase tracking-widest select-none',
        panelVertical
          ? [
              'transition-[width] duration-300 ease-out',
              expanded ? 'w-44' : 'w-12',
            ].join(' ')
          : [
              'transition-[width] duration-300 ease-out',
              expanded ? 'w-max max-w-[min(100vw-2rem,42rem)]' : 'w-max',
            ].join(' '),
        dragging
          ? 'transition-none'
          : 'transition-[top,left,right,bottom,width] duration-200 ease-out',
      ].join(' ')}
      style={asideStyle}
      aria-label="App navigation"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        if (!dragging) setHovered(false)
      }}
    >
      <div
        className={[
          'flex border border-white/10 bg-black/90 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md',
          panelVertical
            ? ['flex-col', expanded ? 'py-2' : 'items-center py-2'].join(' ')
            : ['flex-row items-center gap-0.5 px-1.5 py-1.5', expanded ? '' : ''].join(' '),
        ].join(' ')}
      >
        <button
          type="button"
          aria-label="Drag navigation to screen edge"
          className={[
            'flex shrink-0 touch-none text-white/50 transition-colors hover:text-white/80',
            panelVertical ? 'justify-center px-1 pb-0.5' : 'px-0.5',
          ].join(' ')}
          onPointerDown={onGripPointerDown}
        >
          <DragGrip vertical={panelVertical} />
        </button>

        <button
          type="button"
          onClick={() => setPinnedOpen((value) => !value)}
          aria-expanded={expanded}
          aria-label={pinnedOpen ? 'Collapse navigation' : 'Pin navigation open'}
          className={[
            'flex shrink-0 items-center text-white/50 transition-colors hover:text-white',
            panelVertical
              ? expanded
                ? 'justify-end px-2 py-0.5'
                : 'justify-center px-0 py-0.5'
              : 'px-1 py-1',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 12 12"
            className={[
              'h-3 w-3 fill-none stroke-current transition-transform duration-300',
              panelVertical
                ? expanded
                  ? 'rotate-180'
                  : ''
                : expanded
                  ? 'rotate-90'
                  : '-rotate-90',
            ].join(' ')}
            aria-hidden="true"
          >
            <path d="M8 2 4 6l4 4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <nav
          className={[
            'flex gap-0.5',
            panelVertical ? 'flex-col px-1.5 pb-1.5' : 'flex-row flex-wrap items-center pb-0 pr-0.5',
          ].join(' ')}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                [
                  'flex rounded-sm transition-colors duration-300',
                  panelVertical
                    ? [
                        'items-center gap-3',
                        expanded ? 'px-3 py-2.5' : 'justify-center px-2 py-2.5',
                      ].join(' ')
                    : [
                        'items-center',
                        expanded ? 'flex-col gap-1 px-2.5 py-1.5' : 'justify-center p-2',
                      ].join(' '),
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              <NavIcon item={item} />
              {expanded ? (
                <span className={panelVertical ? 'truncate' : 'text-[10px] leading-tight tracking-wide'}>
                  {item.label}
                </span>
              ) : (
                <span className="sr-only">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
