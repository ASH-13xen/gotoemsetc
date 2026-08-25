import { apiClient } from './client'
import type { TransactionDetails } from './salarySlips.api'

export interface BillInstance {
  _id: string
  year: number
  month: number
  dueDate: string
  status: 'due' | 'paid' | 'paid_late'
  paidAt?: string
  transactionDetails?: TransactionDetails
}

export interface MonthlyBill {
  _id: string
  name: string
  amount: number
  dueDay: number
  isActive: boolean
  instances: BillInstance[]
}

export interface CreateBillInput {
  name: string
  amount: number
  dueDay: number
}

export async function listBills(): Promise<{ bills: MonthlyBill[] }> {
  const { data } = await apiClient.get('/monthly-bills')
  return data
}

export async function createBill(input: CreateBillInput): Promise<{ bill: MonthlyBill }> {
  const { data } = await apiClient.post('/monthly-bills', input)
  return data
}

export async function setBillActive(id: string, isActive: boolean): Promise<{ bill: MonthlyBill }> {
  const { data } = await apiClient.patch(`/monthly-bills/${id}/active`, { isActive })
  return data
}

export async function markBillInstancePaid(
  billId: string,
  instanceId: string,
  input: TransactionDetails
): Promise<{ bill: MonthlyBill }> {
  const { data } = await apiClient.post(`/monthly-bills/${billId}/instances/${instanceId}/mark-paid`, input)
  return data
}
