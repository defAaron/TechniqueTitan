import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

function displayName(email: string | undefined): string {
  if (!email) return 'Account'
  const local = email.split('@')[0]
  return local || email
}

export function AuthControls() {
  const { loading, user, isAdmin, signOut } = useAuth()

  if (loading) {
    return (
      <span className="font-body text-sm uppercase tracking-widest text-white/30" aria-hidden="true">
        …
      </span>
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

  return (
    <span className="flex flex-wrap items-center justify-end gap-4 sm:gap-6">
      {isAdmin && (
        <Link to="/admin" className="transition-colors duration-300 hover:text-white">
          Admin
        </Link>
      )}
      <span className="max-w-[10rem] truncate normal-case tracking-normal text-white/50" title={user.email}>
        {displayName(user.email)}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="uppercase tracking-widest transition-colors duration-300 hover:text-white"
      >
        Sign out
      </button>
    </span>
  )
}
