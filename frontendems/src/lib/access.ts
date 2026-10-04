import type { StoredUser } from '@/lib/authStorage'

// Mirrors the backend's config/access.js — WHO MAY DO WHAT. Every menu, page
// and button decides from `user.access`, which the server works out live from
// the person's login plus the Organisation chart posts they hold. Never
// compare `user.role` for access; it's only their login's own role.
export type AccessKey =
  | 'ems_all'
  | 'hrms'
  | 'attendance_no_time_limit'
  | 'attendance_final_approval'
  | 'operations'
  | 'office_keys_edit'
  | 'finance'
  | 'finance_approve'
  | 'performance_flags'
  | 'events'
  | 'announcements_create'
  | 'audit_log'
  | 'org_chart_edit'
  | 'calendar_see_all'
  | 'direct_document_upload'

export function can(user: StoredUser | null | undefined, key: AccessKey): boolean {
  return Boolean(user?.access?.includes(key))
}

// Holds this role — by login or by a post in the Organisation chart.
export function hasRole(user: StoredUser | null | undefined, ...roles: string[]): boolean {
  const held = user?.roles ?? (user?.role ? [user.role] : [])
  return roles.some((r) => held.includes(r))
}

// Whole sections switched off for now (backend constants.js FEATURES).
export function featureOn(user: StoredUser | null | undefined, feature: 'TASK_MANAGEMENT' | 'CLIENT_MANAGEMENT'): boolean {
  return Boolean(user?.features?.[feature])
}
