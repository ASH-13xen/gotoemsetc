import { apiClient } from './client'

// Only the fields the dashboard's overtime widget needs — the full summary
// shape (counts, penalty units, etc.) lives in frontendems, which owns
// attendance management; this is a read-only self-service glance.
export interface AttendanceSummary {
  totalOvertimeMinutes: number
}

export async function getAttendanceSummary(
  employeeId: string,
  range?: { from?: string; to?: string }
): Promise<{ summary: AttendanceSummary }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/attendance/summary`, {
    params: range,
  })
  return data
}
