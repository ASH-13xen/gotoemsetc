import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/salarySlips.api'
import type { TransactionDetails } from '@/api/salarySlips.api'

const KEY = ['finance-salary-slips']

export function useFinanceSlips(year: number, month: number) {
  return useQuery({ queryKey: [...KEY, year, month], queryFn: () => api.listFinanceSlips(year, month) })
}

export function useMarkSalaryPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionDetails }) => api.markSalaryPaid(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
