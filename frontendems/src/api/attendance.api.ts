import { apiClient } from './client'

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'work_from_home'
  | 'short_day'
  | 'early_leave'

export interface AttendanceRecord {
  _id: string
  employee: string
  date: string
  status: AttendanceStatus
  isBackdated: boolean
  notes?: string
}

export async function markAttendance(
  employeeId: string,
  date: string,
  status: AttendanceStatus,
  notes?: string
): Promise<{ record: AttendanceRecord }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/attendance`, {
    date,
    status,
    notes,
  })
  return data
}

export async function listAttendance(
  employeeId: string,
  month: number,
  year: number
): Promise<{ records: AttendanceRecord[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/attendance`, {
    params: { month, year },
  })
  return data
}
