import type { StoredUser } from '@/lib/authStorage'

// Matches the backend's requireFinanceAccess (see
// backend/src/middlewares/auth.middleware.js): admin, ceo, and the
// account_manager role only — HR and operations_manager are excluded, unlike
// the Monthly Bills tab specifically (see canManageBills below). Gates every
// tab except Monthly Bills.
export function canAccessFinance(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'ceo' || user?.role === 'account_manager'
}

// Monthly Bills' viewing/mark-paid audience is wider than the rest of
// Finance — mirrors the backend's requireBillsAccess.
export function canManageBills(user: StoredUser | null | undefined): boolean {
  return canAccessFinance(user) || user?.role === 'operations_manager'
}

// The remote's own entry gate (RequireFinanceAccess) — anyone who can reach
// at least one tab. Individual tabs still gate themselves narrower.
export function canEnterFinance(user: StoredUser | null | undefined): boolean {
  return canManageBills(user)
}

// Invoice approval and plan-price edits are narrower — admin/ceo only.
export function canApproveInvoices(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'ceo'
}

// Creating/pausing a bill template is admin/ceo only, per spec — narrower
// than canManageBills below, which also covers viewing + marking paid.
export function canCreateBills(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'ceo'
}

// Reimbursement approve/reject is CEO-only.
export function canApproveReimbursements(user: StoredUser | null | undefined): boolean {
  return user?.role === 'ceo'
}
