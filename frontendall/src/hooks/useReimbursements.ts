import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/reimbursements.api'
import type { FileReimbursementInput } from '@/api/reimbursements.api'

const KEY = ['reimbursements', 'mine']

export function useMyReimbursements() {
  return useQuery({ queryKey: KEY, queryFn: api.listMyReimbursements })
}

export function useFileReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, receipt }: { input: FileReimbursementInput; receipt: File }) => api.fileReimbursement(input, receipt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAcknowledgeReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.acknowledgeReimbursement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUploadReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.uploadReceipt(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

// The CEO's/admin's queue: claims Finance has approved.
const CEO_KEY = ['reimbursements', 'awaiting-ceo']

export function useReimbursementsAwaitingCeo(enabled: boolean) {
  return useQuery({ queryKey: CEO_KEY, queryFn: api.listReimbursementsAwaitingCeo, enabled, refetchInterval: 60_000 })
}

export function useCeoApproveReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.ceoApproveReimbursement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reimbursements'] }),
  })
}

export function useCeoRejectReimbursement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.ceoRejectReimbursement(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reimbursements'] }),
  })
}
