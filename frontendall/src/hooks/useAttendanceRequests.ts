import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as attendanceRequestsApi from '@/api/attendanceRequests.api'
import type { LeaveApplicationStatus, HalfDayPeriod } from '@/api/attendanceRequests.api'

const UNSEEN_KEY = ['my-attendance-outcomes-unseen']
const PENDING_CM_REVIEWS_KEY = ['pending-cm-reviews']
const MY_REQUESTS_KEY = ['my-attendance-requests']

export function useMyUnseenAttendanceOutcomes() {
  return useQuery({
    queryKey: UNSEEN_KEY,
    queryFn: () => attendanceRequestsApi.listMyUnseenAttendanceOutcomes(),
  })
}

// Dashboard widget feed — every leave/attendance request this employee has
// filed, any status, newest first.
export function useMyAttendanceRequests() {
  return useQuery({
    queryKey: MY_REQUESTS_KEY,
    queryFn: () => attendanceRequestsApi.listMyAttendanceRequests(),
  })
}

export function useCreateLeaveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      date: string
      endDate: string
      reason: string
      requestedStatus?: LeaveApplicationStatus
      requestedHalfDayPeriod?: HalfDayPeriod
      requestedEarlyDeparture?: boolean
      requestedMultiDayLeave?: boolean
    }) => attendanceRequestsApi.createLeaveApplication(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNSEEN_KEY })
      queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
      queryClient.invalidateQueries({ queryKey: ['monthly-leave-counts'] })
      queryClient.invalidateQueries({ queryKey: ['paid-leave-eligibility'] })
    },
  })
}

// The Content Manager's own dashboard queue — see PendingLeaveApprovalsModal.
export function useMyPendingCmReviews() {
  return useQuery({
    queryKey: PENDING_CM_REVIEWS_KEY,
    queryFn: () => attendanceRequestsApi.listMyPendingCmReviews(),
  })
}

export function useCmApproveRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => attendanceRequestsApi.cmApproveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_CM_REVIEWS_KEY }),
  })
}

export function useCmRejectRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      attendanceRequestsApi.rejectAttendanceRequest(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_CM_REVIEWS_KEY }),
  })
}

// Re-checked every time the dialog's start date changes, so the Paid Leave
// option only ever reflects the month actually being applied for.
export function usePaidLeaveEligibility(date: string) {
  return useQuery({
    queryKey: ['paid-leave-eligibility', date],
    queryFn: () => attendanceRequestsApi.getPaidLeaveEligibility(date),
    enabled: Boolean(date),
  })
}

export function useMyMonthlyLeaveCounts(date: string) {
  return useQuery({
    queryKey: ['monthly-leave-counts', date],
    queryFn: () => attendanceRequestsApi.getMyMonthlyLeaveCounts(date),
    enabled: Boolean(date),
  })
}

export function useAcknowledgeAttendanceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => attendanceRequestsApi.acknowledgeAttendanceRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNSEEN_KEY })
      queryClient.invalidateQueries({ queryKey: MY_REQUESTS_KEY })
    },
  })
}
