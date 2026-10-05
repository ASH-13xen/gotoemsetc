import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/reimbursements.api'
import type { ReimbursementStatus } from '@/api/reimbursements.api'
import type { TransactionDetails } from '@/api/salarySlips.api'

const KEY = ['reimbursements']

export function useReimbursements(status?: ReimbursementStatus) {
  return useQuery({ queryKey: [...KEY, status], queryFn: () => api.listReimbursements(status) })
}

export function useApproveReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.approveReimbursement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRejectReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectReimbursement(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkReimbursementPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input, proof }: { id: string; input: TransactionDetails; proof: File }) =>
      api.markReimbursementPaid(id, input, proof),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
