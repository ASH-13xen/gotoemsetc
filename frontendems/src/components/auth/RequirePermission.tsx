import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { hasPermission } from '@/lib/permissions'
import type { Permission } from '@/api/credentials.api'

// Admins pass through unconditionally; anyone else needs the given
// permission granted on their credential — matches the backend's
// requirePermission on the corresponding route.
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user, isReady } = useAuth()

  if (!isReady) return null
  if (!hasPermission(user, permission)) return <Navigate to="/" replace />

  return <>{children}</>
}
