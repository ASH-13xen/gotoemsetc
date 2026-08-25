import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export type RoleGate = 'admin' | 'worker' | 'cms' | 'hr-work' | 'operations' | 'finance'

// Five gates, not five roles:
//   "admin"       — admin + hr, the existing module lockdown (Events, Audit Log)
//   "worker"      — that literal role
//   "cms"         — anyone logged in may reach Client Management; what they can
//                   actually see and do is scoped server-side by cmsAccess.js
//                   (sales/admin write, hr read-only, employees see only their own
//                   team's clients), which a role check here can't express.
//   "hr-work"     — admin + hr + ceo, matching the backend's
//                   requireAttendanceApprovalAccess and the salary-slip/document-
//                   overview routes HR Work's tools call — ceo included, unlike
//                   "admin" above, since ceo needs sign-off authority there too.
//   "operations"  — admin + ceo + operations_manager, matching the backend's
//                   requireOperationsAccess. Deliberately excludes hr, unlike
//                   every other elevated gate above — the Operations module
//                   (Complaint Register) is admin/ceo/operations_manager only.
//   "finance"     — admin + ceo + account_manager + operations_manager. The
//                   last is wider than the backend's requireFinanceAccess
//                   (admin/ceo/account_manager) — operations_manager only
//                   has access to the Monthly Bills tab within the remote
//                   (matching requireBillsAccess), gated in-page by
//                   frontendfinance's own canAccessFinance/canManageBills,
//                   not here. This gate just decides who can enter at all.
export function RequireRole({ role, children }: { role: RoleGate; children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />

  let allowed: boolean
  if (role === 'admin') allowed = user?.role === 'admin' || user?.role === 'hr'
  else if (role === 'cms') allowed = Boolean(user)
  else if (role === 'hr-work') allowed = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'ceo'
  else if (role === 'operations')
    allowed = user?.role === 'admin' || user?.role === 'ceo' || user?.role === 'operations_manager'
  else if (role === 'finance')
    allowed =
      user?.role === 'admin' ||
      user?.role === 'ceo' ||
      user?.role === 'account_manager' ||
      user?.role === 'operations_manager'
  else allowed = user?.role === role

  if (!allowed) return <Navigate to="/" replace />

  return <>{children}</>
}
