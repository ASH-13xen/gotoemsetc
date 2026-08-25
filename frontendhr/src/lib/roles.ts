import type { StoredUser } from '@/lib/authStorage'

// HR Work is deliberately coarser than frontendems's permission model: it's
// not a "granted capability" a worker can pick up, it's a role-level section
// restricted to admin/hr/ceo — matching the backend's requireAttendanceApprovalAccess
// and the salary-slip/document-overview routes this app's tools call, all of
// which already accept these three roles (ceo included, unlike most of the
// app's admin/HR-only gates — see backend/src/utils/roles.js and
// requireAttendanceApprovalAccess in auth.middleware.js).
export function canAccessHrWork(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'hr' || user?.role === 'ceo'
}
