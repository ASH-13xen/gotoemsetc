import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { canEnterFinance } from '@/lib/roles'

// Every route in this app is Finance — unlike frontendems, there's no
// self-service surface here to fall back to, so an account that lands on
// this remote without access (e.g. a stale bookmark) is sent to /login
// rather than some other page within the app.
export function RequireFinanceAccess({ children }: { children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (!canEnterFinance(user)) return <Navigate to="/login" replace />

  return <>{children}</>
}
