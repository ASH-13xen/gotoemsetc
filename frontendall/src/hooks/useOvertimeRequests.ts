import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/overtimeRequests.api'

const ROOT = ['overtime-requests']

// What is waiting on this person, as a content manager and/or as HR.
export function useOvertimeQueue(enabled = true) {
  return useQuery({ queryKey: [...ROOT, 'queue'], queryFn: api.getOvertimeQueue, enabled, refetchInterval: 60_000 })
}

export function useMyOvertimeRequests(employeeId: string | undefined, period: { month: number; year: number }) {
  return useQuery({
    queryKey: [...ROOT, 'employee', employeeId, period.year, period.month],
    queryFn: () => api.listOvertimeRequestsFor(employeeId as string, period),
    enabled: Boolean(employeeId),
  })
}

function useOvertimeMutation<TInput>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOT })
      // Approved overtime changes the month's total on the overtime card.
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] })
    },
  })
}

export const useApplyForOvertime = () => useOvertimeMutation(api.applyForOvertime)
export const useCmApproveOvertime = () =>
  useOvertimeMutation(({ id, ...input }: { id: string; minutes: number; reason: string }) => api.cmApproveOvertime(id, input))
export const useApproveOvertime = () =>
  useOvertimeMutation(({ id, ...input }: { id: string; minutes: number; note?: string }) => api.approveOvertime(id, input))
export const useRejectOvertime = () => useOvertimeMutation(({ id, reason }: { id: string; reason: string }) => api.rejectOvertime(id, reason))
