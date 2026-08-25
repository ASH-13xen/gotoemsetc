import type { StoredUser } from '@/lib/authStorage'

// Operations is deliberately narrower than HR Work's admin/hr/ceo gate — HR
// is excluded on purpose here, matching the backend's requireOperationsAccess
// (see backend/src/middlewares/auth.middleware.js): only admin, ceo, and the
// operations_manager role can see or act on anything in this app.
export function canAccessOperations(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'ceo' || user?.role === 'operations_manager'
}
