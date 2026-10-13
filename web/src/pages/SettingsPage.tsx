import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/layout'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function SettingsPage() {
  const { user } = useAuth()
  const provider = user?.app_metadata?.provider
  const canChangePassword =
    provider === 'email' || Boolean(user?.identities?.some((identity) => identity.provider === 'email'))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!supabase) {
      setError('Auth is not configured.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Could not update your password.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader eyebrow="Account" title="Settings">
        Account details for this sign-in.
      </PageHeader>

      <dl className="mb-10 space-y-6">
        <div>
          <dt className="mb-2 font-body text-sm uppercase tracking-[0.2em] text-white/40">Email</dt>
          <dd className="font-body text-base text-white">{user?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="mb-2 font-body text-sm uppercase tracking-[0.2em] text-white/40">
            Sign-in
          </dt>
          <dd className="font-body text-base capitalize text-white">{provider ?? 'email'}</dd>
        </div>
      </dl>

      {canChangePassword ? (
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <h2 className="font-cinematic text-2xl font-normal text-white">Password</h2>
          <label className="block">
            <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
              New password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setSaved(false)
              }}
              className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-body text-sm uppercase tracking-[0.2em] text-white/40">
              Confirm password
            </span>
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value)
                setSaved(false)
              }}
              className="w-full border border-white/20 bg-transparent px-4 py-3 text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
            />
          </label>
          {error && (
            <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
              {error}
            </p>
          )}
          {saved && (
            <p className="font-body text-base text-white/70" role="status">
              Password updated.
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="bg-white px-6 py-3 font-body text-sm uppercase tracking-widest text-black transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      ) : (
        <p className="font-body text-base font-light text-white/50">
          This account signs in with {provider === 'google' ? 'Google' : 'an external provider'}.
          Password changes stay with that provider.
        </p>
      )}
    </div>
  )
}
