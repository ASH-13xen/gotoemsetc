import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { canAccessHrWork } from '@/lib/roles'

// Every route in this app is HR Work — unlike frontendems, there's no
// self-service surface here to fall back to, so a worker who somehow lands
// on this remote (e.g. a stale bookmark) is sent to /login rather than some
// other page within the app.
export function RequireHrAccess({ children }: { children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (!canAccessHrWork(user)) return <Navigate to="/login" replace />

  return <>{children}</>
}
