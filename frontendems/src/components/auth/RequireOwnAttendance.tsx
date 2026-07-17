import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'

// Admins and mark_attendance holders can browse anyone's attendance and use
// the employee picker; anyone else is always sent straight to their own —
// matches the backend's requireSelfOrPermission(mark_attendance).
export function RequireOwnAttendance({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()
  const { employeeId } = useParams<{ employeeId?: string }>()

  if (!isReady) return null
  if (hasPermission(user, 'mark_attendance')) return <>{children}</>
  if (!user?.employeeLink) return <Navigate to="/" replace />
  if (employeeId !== user.employeeLink) return <Navigate to={`/attendance/${user.employeeLink}`} replace />
  return <>{children}</>
}
