import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/layout'
import { supabase } from '../lib/supabase'

type ProfileRow = {
  id: string
  email: string | null
  auth_provider: string
  created_at: string
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function AdminStatsPage() {
  const [rows, setRows] = useState<ProfileRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Auth is not configured.')
      return
    }

    let cancelled = false
    void (async () => {
      const rpc = await supabase.rpc('admin_list_signups')
      if (cancelled) return
      if (!rpc.error) {
        setRows((rpc.data ?? []) as ProfileRow[])
        return
      }
      const missingFn = /could not find the function|does not exist|42883/i.test(
        rpc.error.message,
      )
      if (!missingFn) {
        setError(rpc.error.message)
        return
      }
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, email, auth_provider, created_at')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        return
      }
      setRows((data ?? []) as ProfileRow[])
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => {
    const list = rows ?? []
    const email = list.filter((row) => row.auth_provider === 'email').length
    const google = list.filter((row) => row.auth_provider === 'google').length
    return {
      total: list.length,
      email,
      google,
      other: list.length - email - google,
    }
  }, [rows])

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Account signups">
        Counts come from Auth users. Regular users cannot read this list.
      </PageHeader>

      {error && (
        <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
          {error}
        </p>
      )}

      {!error && rows === null && (
        <p className="font-body text-base text-white/50" role="status">
          Loading signups…
        </p>
      )}

      {rows && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="border border-white/10 bg-zinc-950 px-5 py-6">
              <dt className="font-body text-sm uppercase tracking-[0.2em] text-white/40">
                Total accounts
              </dt>
              <dd className="mt-3 font-cinematic text-4xl text-white">{totals.total}</dd>
            </div>
            <div className="border border-white/10 bg-zinc-950 px-5 py-6">
              <dt className="font-body text-sm uppercase tracking-[0.2em] text-white/40">
                Email
              </dt>
              <dd className="mt-3 font-cinematic text-4xl text-white">{totals.email}</dd>
            </div>
            <div className="border border-white/10 bg-zinc-950 px-5 py-6">
              <dt className="font-body text-sm uppercase tracking-[0.2em] text-white/40">
                Google
              </dt>
              <dd className="mt-3 font-cinematic text-4xl text-white">{totals.google}</dd>
            </div>
          </dl>

          {totals.other > 0 && (
            <p className="mt-4 font-body text-sm text-white/40">
              {totals.other} account{totals.other === 1 ? '' : 's'} used another provider.
            </p>
          )}

          <h2 className="mt-12 font-cinematic text-2xl text-white">Recent signups</h2>
          {rows.length === 0 ? (
            <p className="mt-4 font-body text-base text-white/50">No accounts yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left font-body text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-white/40 uppercase tracking-widest">
                    <th className="py-3 pr-4 font-normal">Email</th>
                    <th className="py-3 pr-4 font-normal">Provider</th>
                    <th className="py-3 font-normal">Signed up</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/10">
                      <td className="py-3 pr-4 text-white">{row.email ?? '—'}</td>
                      <td className="py-3 pr-4 capitalize text-white/70">{row.auth_provider}</td>
                      <td className="py-3 text-white/70">{formatWhen(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
