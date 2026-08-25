import { apiClient } from './client'

export type OfficeKey = 'go_to_office' | 'the_arcade' | 'the_verve_studios' | 'cupboard' | 'main_gate'

// Keep in sync with backend/src/config/constants.js#OFFICE_KEY. Order here
// is the fixed display order everywhere this list is rendered.
export const OFFICE_KEYS: OfficeKey[] = ['go_to_office', 'the_arcade', 'the_verve_studios', 'cupboard', 'main_gate']

export const KEY_LABEL: Record<OfficeKey, string> = {
  go_to_office: 'GO-TO Office',
  the_arcade: 'The Arcade',
  the_verve_studios: 'The Verve Studios',
  cupboard: 'Cupboard',
  main_gate: 'Main Gate',
}

// One colour per key, used for the icon, the badge, and the card border —
// same "one hue per item, soft tint" treatment as the attendance status
// colours elsewhere in this codebase.
export const KEY_COLOR: Record<OfficeKey, { icon: string; badge: string; border: string }> = {
  go_to_office: { icon: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700', border: 'border-emerald-500/25' },
  the_arcade: { icon: 'text-violet-500', badge: 'bg-violet-500/10 text-violet-700', border: 'border-violet-500/25' },
  the_verve_studios: { icon: 'text-sky-500', badge: 'bg-sky-500/10 text-sky-700', border: 'border-sky-500/25' },
  cupboard: { icon: 'text-amber-500', badge: 'bg-amber-500/10 text-amber-700', border: 'border-amber-500/25' },
  main_gate: { icon: 'text-red-500', badge: 'bg-red-500/10 text-red-700', border: 'border-red-500/25' },
}

export interface KeyHolderEmployee {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface KeyHolderEntry {
  key: OfficeKey
  holder: KeyHolderEmployee | null
  updatedBy: { _id: string; username: string } | null
  updatedAt: string | null
}

export async function listKeys(): Promise<{ keys: KeyHolderEntry[] }> {
  const { data } = await apiClient.get('/keys')
  return data
}

// employeeId: null clears the key back to unassigned. Operations-only
// server-side (admin/ceo/operations_manager) — see requireOperationsAccess().
export async function assignKey(key: OfficeKey, employeeId: string | null): Promise<{ keyHolder: KeyHolderEntry }> {
  const { data } = await apiClient.post(`/keys/${key}/assign`, { employeeId })
  return data
}
