import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/invoices.api'
import type { InvoiceFilter, PlanTier } from '@/api/invoices.api'
import type { TransactionDetails } from '@/api/salarySlips.api'

const KEY = ['invoices']
const PLAN_PRICE_KEY = ['plan-prices']

export function usePlanPrices() {
  return useQuery({ queryKey: PLAN_PRICE_KEY, queryFn: api.listPlanPrices })
}

export function useSetPlanPrices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (prices: Array<{ plan: PlanTier; amount: number }>) => api.setPlanPrices(prices),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAN_PRICE_KEY }),
  })
}

export function useInvoices(filter: InvoiceFilter) {
  return useQuery({ queryKey: [...KEY, filter], queryFn: () => api.listInvoices(filter) })
}

export function useInvoiceSummary(filter: InvoiceFilter) {
  return useQuery({ queryKey: [...KEY, 'summary', filter], queryFn: () => api.getInvoiceSummary(filter) })
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ year, month }: { year?: number; month?: number }) => api.generateInvoices(year, month),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useApproveInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.approveInvoice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionDetails }) => api.markInvoicePaid(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
