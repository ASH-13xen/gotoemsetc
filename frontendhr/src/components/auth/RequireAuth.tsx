import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, isReady } = useAuth()

  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />

  return <>{children}</>
}
