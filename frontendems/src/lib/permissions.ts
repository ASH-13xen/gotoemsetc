import type { StoredUser } from '@/lib/authStorage'
import type { Permission } from '@/api/credentials.api'
import { can } from '@/lib/access'

// Everyone's EMS (view + edit) — admin, CEO and HR, by login or by holding
// that post in the Organisation chart. Implies every grantable permission.
export function isAdminLike(user: StoredUser | null | undefined): boolean {
  return can(user, 'ems_all')
}

// Attaching a document directly (the Upload Documents section) — the admin
// login only.
export function isAdmin(user: StoredUser | null | undefined): boolean {
  return can(user, 'direct_document_upload')
}

// Everyone's-EMS access, or this permission granted on their own credential
// via Add Credentials. Every check in this app goes through here rather
// than reading user.permissions directly.
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
