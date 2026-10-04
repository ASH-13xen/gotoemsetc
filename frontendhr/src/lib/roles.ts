import type { StoredUser } from '@/lib/authStorage'
import { can } from '@/lib/access'

// HR Work (HRMS) — admin, CEO and HR, by login or by holding that post in the
// Organisation chart. Matches the backend's HRMS access (config/access.js).
export function canAccessHrWork(user: StoredUser | null | undefined): boolean {
  return can(user, 'hrms')
}
