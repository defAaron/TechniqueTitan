import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode
  requireAdmin?: boolean
}) {
  const { configured, loading, user, isAdmin, isAdminLoading } = useAuth()
  const location = useLocation()

  if (!configured) {
    return <Navigate to="/login" replace />
  }

  if (loading || (requireAdmin && isAdminLoading)) {
    return (
      <p className="font-body text-base text-white/50" role="status">
        Checking your session…
      </p>
    )
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (requireAdmin && !isAdmin) {
    return (
      <p className="border border-critical/40 bg-critical/10 px-4 py-3 text-base text-critical">
        This page is limited to project admins.
      </p>
    )
  }

  return children
}
