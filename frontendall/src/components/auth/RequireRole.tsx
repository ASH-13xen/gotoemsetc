import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { can, featureOn, type AccessKey } from '@/lib/access'

// Route gate by access (lib/access.ts) — what the person's login plus their
// Organisation chart posts allow, worked out by the server. Mirrors the
// backend's requireAccess exactly, so a page someone can open is a page its
// API will serve them.
export function RequireAccess({ access, children }: { access: AccessKey; children: ReactNode }) {
  const { user, token, isReady } = useAuth()
  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (!can(user, access)) return <Navigate to="/" replace />
  return <>{children}</>
}

// Whole sections switched off for now (Task Management, Client Management).
export function RequireFeature({ feature, children }: { feature: 'TASK_MANAGEMENT' | 'CLIENT_MANAGEMENT'; children: ReactNode }) {
  const { user, token, isReady } = useAuth()
  if (!isReady) return null
  if (!token) return <Navigate to="/login" replace />
  if (!featureOn(user, feature)) return <Navigate to="/" replace />
  return <>{children}</>
}
