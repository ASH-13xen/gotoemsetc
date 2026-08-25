import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/fnfSettlements.api'
import type { TransactionDetails } from '@/api/salarySlips.api'

const KEY = ['fnf-settlements']

export function useFnfSettlements() {
  return useQuery({ queryKey: KEY, queryFn: api.listFnfSettlements })
}

export function useMarkFnfPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionDetails }) => api.markFnfPaid(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
