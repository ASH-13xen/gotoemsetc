import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as attendanceApi from '@/api/attendance.api'
import type { AttendanceStatus } from '@/api/attendance.api'

export function useAttendance(employeeId: string | undefined, month: number, year: number) {
  return useQuery({
    queryKey: ['attendance', employeeId, month, year],
    queryFn: () => attendanceApi.listAttendance(employeeId as string, month, year),
    enabled: Boolean(employeeId),
  })
}

export function useMarkAttendance(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ date, status, notes }: { date: string; status: AttendanceStatus; notes?: string }) =>
      attendanceApi.markAttendance(employeeId, date, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', employeeId] })
    },
  })
}
