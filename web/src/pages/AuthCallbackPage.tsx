import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { safeNextPath, useAuth } from '../lib/auth'
import { supabaseConfigHelp } from '../lib/supabase'

function oauthErrorFromUrl(search: string, hash: string): string | null {
  const query = new URLSearchParams(search)
  const fromHash = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return (
    query.get('error_description') ||
    query.get('error_code') ||
    query.get('error') ||
    fromHash.get('error_description') ||
    fromHash.get('error_code') ||
    fromHash.get('error')
  )
}

export function friendlyAuthCallbackError(raw: string): string {
  if (/otp_expired|invalid or has expired/i.test(raw)) {
    return 'This confirmation link is invalid or has expired. Request a new email, then click the latest link.'
  }
  if (/access_denied/i.test(raw)) {
    return 'Sign in was denied. Try again or request a new confirmation email.'
  }
  return raw.replace(/\+/g, ' ')
}

export function AuthCallbackPage() {
  const { configured, loading, user, resendSignupEmail } = useAuth()
  const location = useLocation()
  const [oauthError, setOauthError] = useState<string | null>(() => {
    const raw = oauthErrorFromUrl(location.search, location.hash)
    return raw ? friendlyAuthCallbackError(raw) : null
  })
  const [resendEmail, setResendEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const expired = Boolean(
    oauthError && /expired|invalid or has expired/i.test(oauthError),
  )

  useEffect(() => {
    const raw = oauthErrorFromUrl(location.search, location.hash)
    setOauthError(raw ? friendlyAuthCallbackError(raw) : null)
  }, [location.search, location.hash])

  useEffect(() => {
    if (loading || user || oauthError) return
    const timer = window.setTimeout(() => {
      setOauthError('Sign in did not complete. Try again.')
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [loading, user, oauthError])

  async function onResend(event: FormEvent) {
    event.preventDefault()
    setResendError(null)
    setResendBusy(true)
    try {
      await resendSignupEmail(resendEmail.trim())
      setResendDone(true)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Could not resend the email. Try again in a minute.'
      setResendError(message)
    } finally {
      setResendBusy(false)
    }
  }

  if (!configured) {
    return (
      <div className="max-w-md">
        <PageHeader eyebrow="Account" title="Sign in">
          {supabaseConfigHelp()}
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
        {expired && !resendDone && (
          <form className="mb-8 space-y-4" onSubmit={(e) => void onResend(e)}>
            <label className="block">
              <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
                placeholder="you@example.com"
              />
            </label>
            {resendError && (
              <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
                {resendError}
              </p>
            )}
            <button
              type="submit"
              disabled={resendBusy}
              className="w-full bg-white px-6 py-3 font-body text-sm uppercase tracking-widest text-black transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {resendBusy ? 'Please wait…' : 'Send a new confirmation email'}
            </button>
          </form>
        )}
        {resendDone && (
          <p className="mb-8 font-body text-base text-white/70">
            Check your inbox for a new link. Use only the latest email.
          </p>
        )}
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
