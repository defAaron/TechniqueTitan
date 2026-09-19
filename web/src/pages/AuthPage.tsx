import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/layout'
import { safeNextPath, useAuth } from '../lib/auth'
import { supabaseConfigHelp } from '../lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function authMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: string }).message)
    if (/invalid login credentials/i.test(message)) {
      return 'Email or password is incorrect.'
    }
    if (/user already registered/i.test(message)) {
      return 'An account with that email already exists. Sign in instead.'
    }
    if (/email not confirmed/i.test(message)) {
      return 'Confirm your email before signing in. Check your inbox for the link.'
    }
    if (/invalid api key/i.test(message)) {
      return 'Supabase rejected the API key in this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the same project (full anon/publishable key, one line, no quotes) on Vercel, then redeploy.'
    }
    return message
  }
  return 'Something went wrong. Try again.'
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const {
    configured,
    loading,
    user,
    signInWithPassword,
    signUpWithPassword,
    resendSignupEmail,
    signInWithGoogle,
  } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)

  const isSignup = mode === 'signup'
  const switchTo = isSignup
    ? `/login${location.search}`
    : `/signup${location.search}`

  if (!loading && user) {
    return <Navigate to={next} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (isSignup && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUpWithPassword(email.trim(), password)
        if (needsConfirmation) setCheckEmail(true)
      } else {
        await signInWithPassword(email.trim(), password)
      }
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    setError(null)
    setResendBusy(true)
    try {
      await resendSignupEmail(email.trim())
      setCheckEmail(true)
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setResendBusy(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(authMessage(err))
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <div className="max-w-md">
        <PageHeader eyebrow="Account" title={isSignup ? 'Sign up' : 'Sign in'}>
          {supabaseConfigHelp()}
        </PageHeader>
      </div>
    )
  }

  if (checkEmail) {
    return (
      <div className="max-w-md">
        <PageHeader eyebrow="Account" title="Check your email">
          We sent a confirmation link to {email}. Open it to finish creating your
          account, then sign in. Use the latest email if you request another.
        </PageHeader>
        {error && (
          <p className="mb-6 border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={resendBusy || !email.trim()}
          onClick={() => void onResend()}
          className="mb-8 block font-body text-sm uppercase tracking-widest text-white/60 transition-colors hover:text-white disabled:opacity-50"
        >
          {resendBusy ? 'Sending…' : 'Resend confirmation email'}
        </button>
        <Link
          to="/login"
          className="font-body text-sm uppercase tracking-widest text-white/60 transition-colors hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <PageHeader eyebrow="Account" title={isSignup ? 'Create an account' : 'Sign in'}>
        {isSignup
          ? 'Email and password, or continue with Google. An account is required for photo, video, and live.'
          : 'Welcome back. Sign in to continue to photo, video, or live practice.'}
      </PageHeader>

      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="block">
          <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
            Email
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            placeholder="At least 6 characters"
          />
        </label>
        {isSignup && (
          <label className="block">
            <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
              Confirm password
            </span>
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            />
          </label>
        )}

        {error && (
          <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
            {error}
          </p>
        )}
        {!isSignup && error && /confirm your email/i.test(error) && (
          <button
            type="button"
            disabled={resendBusy || !email.trim()}
            onClick={() => void onResend()}
            className="font-body text-sm uppercase tracking-widest text-white/60 transition-colors hover:text-white disabled:opacity-50"
          >
            {resendBusy ? 'Sending…' : 'Resend confirmation email'}
          </button>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-white px-6 py-3 font-body text-sm uppercase tracking-widest text-black transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-body text-sm uppercase tracking-widest text-white/30">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void onGoogle()}
        className="flex w-full items-center justify-center gap-3 border border-white/20 bg-transparent px-6 py-3 font-body text-sm uppercase tracking-widest text-white transition-colors hover:border-white/50 disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="mt-8 font-body text-sm text-white/40">
        {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
        <Link
          to={switchTo}
          className="uppercase tracking-widest text-white/70 transition-colors hover:text-white"
        >
          {isSignup ? 'Sign in' : 'Sign up'}
        </Link>
      </p>
    </div>
  )
}
