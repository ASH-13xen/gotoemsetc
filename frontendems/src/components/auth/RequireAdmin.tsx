import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

// Redirects any non-admin (worker) away — Home itself then routes a worker
// to their own employee record, so this never dead-ends.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth()

  if (!isReady) return null
  if (user?.role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}
