import type { StoredUser } from '@/lib/authStorage'
import { can } from '@/lib/access'

// Finance — admin, CFO and Finance, by login or by holding that post in the
// Organisation chart (the CEO and Operations no longer have it). Matches the
// backend's FINANCE access. Monthly Bills are part of Finance.
export function canAccessFinance(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance')
}

export function canManageBills(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance')
}

export function canEnterFinance(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance')
}

// Approving inside Finance — invoices, plan prices, bill templates — admin
// and the CFO.
export function canApproveInvoices(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance_approve')
}

export function canCreateBills(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance_approve')
}

export function canApproveReimbursements(user: StoredUser | null | undefined): boolean {
  return can(user, 'finance')
}
