import { apiClient } from './client'

// The subset of ATTENDANCE_STATUS that means "not fully at their desk in
// the normal way" — see attendance.service.js#listWhosOutForMonth.
export type WhosOutStatus = 'O' | 'H' | 'SL' | 'W'

export interface WhosOutEntry {
  employee: { _id: string; firstName: string; lastName?: string }
  date: string
  // null when the entry exists only for earlyDeparture, with no "out" status.
  status: WhosOutStatus | null
  earlyDeparture: boolean
}

export async function listWhosOut(month: number, year: number): Promise<{ entries: WhosOutEntry[] }> {
  const { data } = await apiClient.get('/company-calendar', { params: { month, year } })
  return data
}
