import { apiClient } from './client'
import type { SlipEmployeeRef, TransactionDetails } from './salarySlips.api'

export interface FnfSettlement {
  _id: string
  employee: SlipEmployeeRef
  amount?: number
  status: 'due' | 'paid'
  paidAt?: string
  transactionDetails?: TransactionDetails
}

export async function listFnfSettlements(): Promise<{ settlements: FnfSettlement[] }> {
  const { data } = await apiClient.get('/fnf-settlements')
  return data
}

export async function markFnfPaid(id: string, input: TransactionDetails): Promise<{ settlement: FnfSettlement }> {
  const { data } = await apiClient.post(`/fnf-settlements/${id}/mark-paid`, input)
  return data
}
