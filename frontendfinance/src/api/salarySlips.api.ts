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
  // 'held' = the CEO held this salary back: shown faded, can't be paid.
  approvalStatus?: 'approved' | 'held' | null
  paidAt?: string
  transactionDetails?: TransactionDetails
  // Finance's receipt for the payment (the file is fetched separately).
  paymentReceiptFile?: { filename?: string; contentType?: string }
}

export async function listFinanceSlips(year: number, month: number): Promise<{ slips: FinanceSalarySlip[] }> {
  const { data } = await apiClient.get('/salary-slips/finance', { params: { year, month } })
  return data
}

// Sent as multipart: the transaction details as fields plus the payment
// receipt as `receipt` (required — it is mailed to the employee).
export async function markSalaryPaid(id: string, input: TransactionDetails, receipt: File): Promise<{ slip: FinanceSalarySlip }> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, String(value))
  }
  formData.append('receipt', receipt)
  const { data } = await apiClient.post(`/salary-slips/${id}/mark-paid`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// The month's master salary sheet — approved slips only.
export async function downloadFinanceMasterSheet(year: number, month: number): Promise<Blob> {
  const { data } = await apiClient.get('/salary-slips/finance/master-sheet', { params: { year, month }, responseType: 'blob' })
  return data
}

export async function downloadFinanceSlip(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/salary-slips/finance/${id}/file`, { responseType: 'blob' })
  return data
}

export async function downloadSalaryReceipt(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/salary-slips/${id}/payment-receipt`, { responseType: 'blob' })
  return data
}
