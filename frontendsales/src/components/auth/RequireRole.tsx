import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export type AppRole =
  | 'admin'
  | 'ceo'
  | 'digital_admin'
  | 'hr'
  | 'operations_manager'
  | 'account_manager'
  | 'team_lead'
  | 'worker'

// Coarse gate only. Client Management's real access rules are per-client and
// per-team (sales/admin write, hr read-only, employees limited to their own
// team's clients) and are enforced server-side by utils/cmsAccess.js — see
// useCmsAccess for the UI-side mirror used to hide controls.
export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
