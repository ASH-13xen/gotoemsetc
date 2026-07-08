import { apiClient } from './client'

export type AttendanceStatus = 'P' | 'O' | 'H' | 'L' | 'SL' | 'W'

export interface AttendanceRecord {
  _id: string
  employee: string
  date: string
  status?: AttendanceStatus
  overtimeHours: number
  isBackdated: boolean
  notes?: string
}

export async function markAttendance(
  employeeId: string,
  date: string,
  input: { status?: AttendanceStatus; overtimeHours?: number; notes?: string }
): Promise<{ record: AttendanceRecord }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/attendance`, {
    date,
    ...input,
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
