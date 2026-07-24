import type { StoredUser } from '@/lib/authStorage'
import type { Permission } from '@/api/credentials.api'

// HR is admin-equivalent everywhere except the attendance-edit age limit
// (enforced server-side) — single source of truth so it doesn't drift
// component by component.
export function isAdminLike(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'hr'
}

// Strictly the admin role — unlike isAdminLike, HR does NOT pass. Only for
// the handful of things product explicitly wants admin-only (e.g. the
// Upload Documents section), not the general admin/HR equivalence above.
export function isAdmin(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin'
}

// Admin (and HR) always have everything implicitly — every check in this
// app should go through this helper rather than reading user.permissions
// directly.
export function hasPermission(user: StoredUser | null | undefined, permission: Permission): boolean {
  if (!user) return false
  if (isAdminLike(user)) return true
  return user.permissions?.includes(permission) ?? false
}

export function hasAnyPermission(user: StoredUser | null | undefined): boolean {
  if (!user) return false
  if (isAdminLike(user)) return true
  return (user.permissions?.length ?? 0) > 0
}
