import { apiClient } from './client'

// Set by the backend for a non-normal arrival/departure scan (null when
// normal) — see attendanceClassifier.service.js#scanCategories.
export type ScanTimeCategory = 'late' | 'short_leave' | 'half_day' | 'absent'

export interface DevicePunch {
  _id: string
  employeeCode: string
  employee?: {
    _id: string
    firstName: string
    lastName?: string
    employeeCode: string
    designation?: string
  } | null
  timestamp: string
  deviceSerial?: string
  timeCategory?: ScanTimeCategory | null
}

export async function listDevicePunches(params?: {
  limit?: number
  employeeId?: string
  // 'YYYY-MM-DD' — restricts to scans within that one calendar day.
  date?: string
}): Promise<{ punches: DevicePunch[] }> {
  const { data } = await apiClient.get('/device-punches', { params })
  return data
}
