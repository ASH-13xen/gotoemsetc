import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as attendanceRequestsApi from '@/api/attendanceRequests.api'
import type { AttendanceRequestStatus } from '@/api/attendanceRequests.api'
import type { AttendanceStatus } from '@/api/attendance.api'

const KEY = ['attendance-requests']

export function useAttendanceRequests(status?: AttendanceRequestStatus) {
  return useQuery({
    queryKey: [...KEY, status],
    queryFn: () => attendanceRequestsApi.listAttendanceRequests({ status }),
  })
}

export function useResolveAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      overtimeMinutes,
      isLate,
      earlyDeparture,
    }: {
      id: string
      status?: AttendanceStatus
      overtimeMinutes?: number
      isLate?: boolean
      earlyDeparture?: boolean
    }) => attendanceRequestsApi.resolveAttendanceRequest(id, { status, overtimeMinutes, isLate, earlyDeparture }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRejectAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      attendanceRequestsApi.rejectAttendanceRequest(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRevokeAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => attendanceRequestsApi.revokeAttendanceRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
