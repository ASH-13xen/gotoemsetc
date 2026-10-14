import { apiClient } from './client'
import type { SlipEmployeeRef, TransactionDetails } from './salarySlips.api'

// Approved full & final settlements (and older ones from before approvals).
// The total is the final salary slip plus the document's severance.
export interface FnfSettlement {
  _id: string
  employee: SlipEmployeeRef
  amount?: number
  status: 'due' | 'paid'
  stage?: 'hr' | 'ceo' | 'finance' | null
  lastWorkingDay?: string
  salarySlip?: { _id: string; startDate: string; endDate: string; netPayable: number } | null
  finalSalary: number
  severance: number
  total: number
  paidAt?: string
  transactionDetails?: TransactionDetails
  paymentReceiptFile?: { filename?: string }
}

export async function listFnfSettlements(): Promise<{ settlements: FnfSettlement[] }> {
  const { data } = await apiClient.get('/fnf-settlements')
  return data
}

// Sent as multipart: the transaction details as fields plus the payment
// receipt as `receipt` (required — it is mailed to the employee).
export async function markFnfPaid(id: string, input: TransactionDetails, receipt: File): Promise<{ settlement: FnfSettlement }> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, String(value))
  }
  formData.append('receipt', receipt)
  const { data } = await apiClient.post(`/fnf-settlements/${id}/mark-paid`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function downloadFnfFile(id: string, which: 'document' | 'slip' | 'payment-receipt'): Promise<Blob> {
  const { data } = await apiClient.get(`/fnf-settlements/${id}/${which}`, { responseType: 'blob' })
  return data
}
