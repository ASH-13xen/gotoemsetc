// Mirrors USER_ROLES and ROLE_HIERARCHY in the backend's config/constants.js.
//
// As there: the hierarchy is descriptive, not an authorisation mechanism.
// Sitting above another role grants nothing — every gate is still an explicit
// check (RequireRole here, requireRole/requirePermission server-side). It
// exists so this shell can pick a dashboard per role and order role lists
// consistently.
export type AppRole =
  | 'admin'
  | 'ceo'
  | 'digital_admin'
  | 'hr'
  | 'operations_manager'
  | 'account_manager'
  | 'team_lead'
  | 'worker'

export interface RoleNode {
  level: number
  reportsTo: AppRole | null
  label: string
}

export const ROLE_HIERARCHY: Record<AppRole, RoleNode> = {
  admin: { level: 0, reportsTo: null, label: 'Admin' },
  ceo: { level: 1, reportsTo: 'admin', label: 'CEO' },
  digital_admin: { level: 2, reportsTo: 'ceo', label: 'Digital Admin' },
  hr: { level: 2, reportsTo: 'ceo', label: 'HR' },
  operations_manager: { level: 2, reportsTo: 'ceo', label: 'Operations Manager' },
  account_manager: { level: 2, reportsTo: 'ceo', label: 'Account Manager' },
  team_lead: { level: 2, reportsTo: 'ceo', label: 'Team Lead' },
  worker: { level: 3, reportsTo: 'hr', label: 'Employee' },
}

export function roleLabel(role?: string | null): string {
  if (!role) return '—'
  return ROLE_HIERARCHY[role as AppRole]?.label ?? role
}

export function roleLevel(role?: string | null): number {
  if (!role) return Number.MAX_SAFE_INTEGER
  return ROLE_HIERARCHY[role as AppRole]?.level ?? Number.MAX_SAFE_INTEGER
}

// Admin + HR keep the elevated access they already had. Deliberately does NOT
// include ceo or the other roles: they have no permissions wired up yet, and
// quietly folding them in here would grant EMS-wide access nobody asked for.
// Widen this only when that access is actually intended.
export function isAdminLike(role?: string | null): boolean {
  return role === 'admin' || role === 'hr'
}
