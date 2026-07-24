import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isAdmin } from '@/lib/permissions'

// Strictly the admin role — HR does not pass, unlike most of this app's
// admin/HR-equivalent gates. Matches the backend's requireRole(ADMIN) (not
// ADMIN, HR) on the corresponding route.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()

  if (!isReady) return null
  if (!isAdmin(user)) return <Navigate to="/" replace />

  return <>{children}</>
}
