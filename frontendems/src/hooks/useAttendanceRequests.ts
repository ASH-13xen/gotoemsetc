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

export function useCreateAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { date: string; reason: string }) => attendanceRequestsApi.createAttendanceRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useResolveAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      overtimeHours,
      isLate,
    }: {
      id: string
      status?: AttendanceStatus
      overtimeHours?: number
      isLate?: boolean
    }) => attendanceRequestsApi.resolveAttendanceRequest(id, { status, overtimeHours, isLate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}
