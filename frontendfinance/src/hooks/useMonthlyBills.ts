import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/monthlyBills.api'
import type { CreateBillInput } from '@/api/monthlyBills.api'
import type { TransactionDetails } from '@/api/salarySlips.api'

const KEY = ['monthly-bills']

export function useMonthlyBills() {
  return useQuery({ queryKey: KEY, queryFn: api.listBills })
}

export function useCreateBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBillInput) => api.createBill(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetBillActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setBillActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkBillInstancePaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, instanceId, input }: { billId: string; instanceId: string; input: TransactionDetails }) =>
      api.markBillInstancePaid(billId, instanceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
