import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { hasAnyPermission } from '@/lib/permissions'

// Admins can view any employee; a worker can view their own record, or any
// employee's if they hold at least one granted permission (they need
// directory access to use it) — matches the backend's
// requireSelfOrDirectoryAccess on GET /employees/:id.
export function RequireOwnEmployee({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()
  const { id } = useParams<{ id: string }>()

  if (!isReady) return null
  if (user?.role === 'admin') return <>{children}</>
  if (user?.employeeLink && user.employeeLink === id) return <>{children}</>
  if (hasAnyPermission(user)) return <>{children}</>
  return <Navigate to="/" replace />
}
