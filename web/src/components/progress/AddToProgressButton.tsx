import { useState } from 'react'
import { useAuth } from '../../lib/auth'
import type { SessionDraftOut } from '../../lib/api'
import { saveProgressSession } from '../../lib/progress'

type Props = {
  draft: SessionDraftOut | null | undefined
  className?: string
}

export function AddToProgressButton({ draft, className = '' }: Props) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = !draft?.hands?.length || busy || saved

  async function onSave() {
    if (!draft?.hands?.length || !user) return
    setBusy(true)
    setError(null)
    try {
      await saveProgressSession(draft, user.id)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onSave()}
        className="border border-white/30 px-6 py-2.5 font-body text-sm uppercase tracking-[0.28em] text-white/80 transition-all duration-500 hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saved ? 'Saved to progress' : busy ? 'Saving…' : 'Add to progress'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-critical" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
