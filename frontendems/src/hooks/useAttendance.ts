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

export function useAttendanceSummary(employeeId: string | undefined, range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['attendance-summary', employeeId, range?.from, range?.to],
    queryFn: () => attendanceApi.getAttendanceSummary(employeeId as string, range),
    enabled: Boolean(employeeId),
  })
}

export function useAttendanceMarkedToday(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['attendance-marked-today'],
    queryFn: () => attendanceApi.getAttendanceMarkedToday(),
    enabled: options?.enabled ?? true,
  })
}

export function useMarkAttendance(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      date,
      status,
      overtimeHours,
      isLate,
      earlyDeparture,
      notes,
    }: {
      date: string
      status?: AttendanceStatus
      overtimeHours?: number
      isLate?: boolean
      earlyDeparture?: boolean
      notes?: string
    }) => attendanceApi.markAttendance(employeeId, date, { status, overtimeHours, isLate, earlyDeparture, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', employeeId] })
      queryClient.invalidateQueries({ queryKey: ['attendance-marked-today'] })
    },
  })
}
