import { useQuery } from '@tanstack/react-query'
import * as attendanceApi from '@/api/attendance.api'

export function useAttendanceSummary(employeeId: string | undefined, range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['attendance-summary', employeeId, range?.from, range?.to],
    queryFn: () => attendanceApi.getAttendanceSummary(employeeId as string, range),
    enabled: Boolean(employeeId),
  })
}
