import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Admins can view any employee; a worker can only view the employee record
// linked to their own login — matches the backend's requireSelfOrAdmin on
// GET /employees/:id.
export function RequireOwnEmployee({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()
  const { id } = useParams<{ id: string }>()

  if (!isReady) return null
  if (user?.role === 'admin') return <>{children}</>
  if (user?.employeeLink && user.employeeLink === id) return <>{children}</>
  return <Navigate to="/" replace />
}
