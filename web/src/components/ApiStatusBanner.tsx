import { useEffect, useState } from 'react'
import { pingApi } from '../lib/api'

/** Warn when the FastAPI backend is unreachable (common in production if Railway is down). */
export function ApiStatusBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    void pingApi().then((ok) => {
      if (!cancelled) setOffline(!ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="border-b border-critical/40 bg-critical/10 px-4 py-2 text-center text-sm text-critical"
    >
      Analysis API is unreachable. Photo, video, and live scoring need the backend — check
      Railway <code className="font-mono">/v1/health</code>.
    </div>
  )
}
