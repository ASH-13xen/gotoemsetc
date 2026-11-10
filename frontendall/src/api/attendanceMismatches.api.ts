import { apiClient } from './client'

// A day whose scans told a different story from the approved request —
// backend attendanceClassifier.service.js#checkRequestDay. 'changed': the day
// now follows the scans; 'unclear': one scan or an odd pattern, kept as
// approved for HR to check.
export interface AttendanceMismatch {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string } | null
  date: string
  applied: string
  scans: string
  outcome: 'changed' | 'unclear'
  message: string
  updatedAt: string
}

export async function listAttendanceMismatches() {
  const { data } = await apiClient.get<{ mismatches: AttendanceMismatch[] }>('/action-centre/attendance-mismatches')
  return data.mismatches
}
