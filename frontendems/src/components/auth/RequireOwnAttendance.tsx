import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Admins can browse anyone's attendance and use the employee picker; a
// worker is always sent straight to their own — matches the backend's
// requireSelfOrAdmin on GET /employees/:id/attendance.
export function RequireOwnAttendance({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()
  const { employeeId } = useParams<{ employeeId?: string }>()

  if (!isReady) return null
  if (user?.role === 'admin') return <>{children}</>
  if (!user?.employeeLink) return <Navigate to="/" replace />
  if (employeeId !== user.employeeLink) return <Navigate to={`/attendance/${user.employeeLink}`} replace />
  return <>{children}</>
}
