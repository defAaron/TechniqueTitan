import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { safeNextPath, useAuth } from '../lib/auth'

function oauthErrorFromUrl(search: string, hash: string): string | null {
  const query = new URLSearchParams(search)
  const fromHash = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return (
    query.get('error_description') ||
    query.get('error') ||
    fromHash.get('error_description') ||
    fromHash.get('error')
  )
}

export function AuthCallbackPage() {
  const { configured, loading, user } = useAuth()
  const location = useLocation()
  const [oauthError, setOauthError] = useState<string | null>(null)

  useEffect(() => {
    setOauthError(oauthErrorFromUrl(location.search, location.hash))
  }, [location.search, location.hash])

  useEffect(() => {
    if (loading || user || oauthError) return
    const timer = window.setTimeout(() => {
      setOauthError('Sign in did not complete. Try again.')
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [loading, user, oauthError])

  if (!configured) {
    return (
      <div className="max-w-md">
        <PageHeader eyebrow="Account" title="Sign in">
          Auth is not configured in this build.
        </PageHeader>
        <Link
          to="/login"
          className="font-body text-sm uppercase tracking-widest text-white/60 hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  if (oauthError) {
    return (
      <div className="max-w-md">
        <PageHeader eyebrow="Account" title="Sign in failed">
          {oauthError}
        </PageHeader>
        <Link
          to="/login"
          className="font-body text-sm uppercase tracking-widest text-white/60 hover:text-white"
        >
          Try again
        </Link>
      </div>
    )
  }

  if (loading || !user) {
    return (
      <p className="font-body text-base text-white/50" role="status">
        Finishing sign in…
      </p>
    )
  }

  const next = safeNextPath(new URLSearchParams(location.search).get('next'))
  return <Navigate to={next} replace />
}
