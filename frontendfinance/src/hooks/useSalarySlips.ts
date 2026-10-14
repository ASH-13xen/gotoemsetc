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
    mutationFn: ({ id, input, receipt }: { id: string; input: TransactionDetails; receipt: File }) => api.markSalaryPaid(id, input, receipt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
