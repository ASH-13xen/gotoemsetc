import type { StoredUser } from '@/lib/authStorage'
import { can } from '@/lib/access'

// Operations — admin, CEO and Operations, by login or by holding that post
// in the Organisation chart. HR is not included. Matches the backend.
export function canAccessOperations(user: StoredUser | null | undefined): boolean {
  return can(user, 'operations')
}
