import { apiClient } from './client'

export interface SlipEmployeeRef {
  _id: string
  firstName: string
  lastName?: string
  employeeCode?: string
}

export interface TransactionDetails {
  mode?: string
  referenceNumber?: string
  paidOn?: string
  note?: string
}

export interface FinanceSalarySlip {
  _id: string
  employee: SlipEmployeeRef
  startDate: string
  endDate: string
  netPayable: number
  paymentStatus: 'due' | 'paid'
  paidAt?: string
  transactionDetails?: TransactionDetails
}

export async function listFinanceSlips(year: number, month: number): Promise<{ slips: FinanceSalarySlip[] }> {
  const { data } = await apiClient.get('/salary-slips/finance', { params: { year, month } })
  return data
}

export async function markSalaryPaid(id: string, input: TransactionDetails): Promise<{ slip: FinanceSalarySlip }> {
  const { data } = await apiClient.post(`/salary-slips/${id}/mark-paid`, input)
  return data
}
