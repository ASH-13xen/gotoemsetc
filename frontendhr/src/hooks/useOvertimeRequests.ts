import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/overtimeRequests.api'

const ROOT = ['overtime-requests']

export function useOvertimeRequests(params: { status?: api.OvertimeStatus; month?: number; year?: number }) {
  return useQuery({ queryKey: [...ROOT, params], queryFn: () => api.listOvertimeRequests(params), refetchInterval: 60_000 })
}

function useOvertimeMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOT }) })
}

export const useApproveOvertime = () =>
  useOvertimeMutation(({ id, minutes, note }: { id: string; minutes: number; note?: string }) => api.approveOvertime(id, { minutes, note }))
export const useRejectOvertime = () => useOvertimeMutation(({ id, reason }: { id: string; reason: string }) => api.rejectOvertime(id, reason))
