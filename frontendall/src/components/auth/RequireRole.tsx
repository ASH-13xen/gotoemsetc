import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireRole({ role, children }: { role: 'admin' | 'worker'; children: ReactNode }) {
  const { user, token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== role) return <Navigate to="/" replace />

  return <>{children}</>
}
