import type { StoredUser } from '@/lib/authStorage'
import type { Permission } from '@/api/credentials.api'

// Admin always has everything implicitly — every check in this app should
// go through this helper rather than reading user.permissions directly.
export function hasPermission(user: StoredUser | null | undefined, permission: Permission): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.permissions?.includes(permission) ?? false
}

export function hasAnyPermission(user: StoredUser | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return (user.permissions?.length ?? 0) > 0
}
