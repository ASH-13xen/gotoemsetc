import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// HR is treated as admin-equivalent for module lockdown — pass
// role="admin" and both admin and hr get through.
export function RequireRole({ role, children }: { role: 'admin' | 'worker'; children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  const allowed = role === 'admin' ? user?.role === 'admin' || user?.role === 'hr' : user?.role === role
  if (!allowed) return <Navigate to="/" replace />

  return <>{children}</>
}
