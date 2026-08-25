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
    mutationFn: (input: FileReimbursementInput) => api.fileReimbursement(input),
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
