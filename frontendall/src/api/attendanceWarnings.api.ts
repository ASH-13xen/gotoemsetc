import { apiClient } from './client'

export type WarningCategory = 'late' | 'early_departure' | 'half_day' | 'short_leave' | 'absent'

// Keep in sync with backend/src/config/constants.js#ATTENDANCE_WARNING_CATEGORY.
export const CATEGORY_LABEL: Record<WarningCategory, string> = {
  late: 'Late',
  early_departure: 'Early Departure',
  half_day: 'Half Day',
  short_leave: 'Short Leave',
  absent: 'Absent',
}

export interface PendingWarning {
  notificationId: string
  category: WarningCategory
  date: string
  message: string
  countThisMonth: number
}

export async function getPendingWarnings(): Promise<{ warnings: PendingWarning[] }> {
  const { data } = await apiClient.get('/attendance-warnings/pending')
  return data
}
