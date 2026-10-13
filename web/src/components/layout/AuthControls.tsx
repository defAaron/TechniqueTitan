import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ProfileAvatar } from '../account/ProfileAvatar'
import { useAuth } from '../../lib/auth'
import { useProfile } from '../../lib/profile'

export function AuthControls() {
  const { loading, user, signOut } = useAuth()
  const { displayName, avatarSrc } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (loading) {
    return (
      <span
        className="inline-block h-8 w-8 animate-pulse rounded-full bg-white/10"
        aria-hidden="true"
      />
    )
  }

  if (!user) {
    return (
      <span className="flex items-center gap-4 sm:gap-6">
        <Link to="/login" className="transition-colors duration-300 hover:text-white">
          Sign in
        </Link>
        <Link to="/signup" className="text-white transition-colors duration-300 hover:text-white/80">
          Sign up
        </Link>
      </span>
    )
  }

  async function onSignOut() {
    setOpen(false)
    navigate('/', { replace: true })
    try {
      await signOut()
    } catch {
      /* Stay on the landing page; the session is unchanged if sign-out failed. */
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="block rounded-full transition-opacity hover:opacity-80"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        <ProfileAvatar src={avatarSrc} name={displayName} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-3 w-64 border border-white/10 bg-black/95 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <ProfileAvatar src={avatarSrc} name={displayName} size="sm" />
            <span className="min-w-0 truncate font-body text-sm normal-case tracking-normal text-white">
              {displayName}
            </span>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            className="block px-4 py-2.5 font-body text-sm uppercase tracking-widest text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Edit profile
          </Link>
          <Link
            role="menuitem"
            to="/settings"
            className="block px-4 py-2.5 font-body text-sm uppercase tracking-widest text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Settings
          </Link>
          <Link
            role="menuitem"
            to="/about"
            className="block px-4 py-2.5 font-body text-sm uppercase tracking-widest text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            About
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void onSignOut()}
            className="block w-full px-4 py-2.5 text-left font-body text-sm uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-white/5 hover:text-[#f87171]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
