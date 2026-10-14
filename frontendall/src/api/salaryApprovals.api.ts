import { apiClient } from './client'

// Generated salary slips wait for the CEO or admin before they are mailed
// or reach Finance — see backend salaryBatch.service.js.

export interface BatchSlip {
  _id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  designation: string
  startDate: string
  endDate: string
  netPayable: number
  // Where their slip will be mailed; null = no Company Mail ID on their record.
  companyEmail: string | null
}

export interface SlipEmailResult {
  employeeName: string
  to?: string
  status: 'sent' | 'failed' | 'no_address'
  error?: string
}

export interface SalaryBatch {
  _id: string
  // bulk = the whole month from HR Work; single = one slip from an employee's page.
  kind: 'bulk' | 'single'
  month: number
  year: number
  periodLabel: string
  status: 'pending' | 'approved' | 'sent_back' | 'superseded'
  slips: BatchSlip[]
  slipCount: number
  totalNetPayable: number
  withoutCompanyEmail: number
  createdAt: string
  decidedAt?: string
  createdByInfo?: { name: string; asLabel: string | null }
  emailResults: SlipEmailResult[]
  masterSheetEmail?: { to?: string; status?: 'sent' | 'failed'; error?: string }
}

export async function listSalaryBatches() {
  const { data } = await apiClient.get<{ pending: SalaryBatch[]; recent: SalaryBatch[] }>('/salary-slips/batches')
  return data
}

export async function approveSalaryBatch(id: string) {
  const { data } = await apiClient.post<{ batch: SalaryBatch }>(`/salary-slips/batches/${id}/approve`, {})
  return data.batch
}

export async function sendBackSalaryBatch(id: string, note: string) {
  const { data } = await apiClient.post<{ batch: SalaryBatch }>(`/salary-slips/batches/${id}/send-back`, { note })
  return data.batch
}

// Every slip in the batch plus the month's master sheet, as one zip.
export async function downloadSalaryBatchZip(batch: SalaryBatch): Promise<Blob> {
  const { data } = await apiClient.post(
    '/salary-slips/bulk-zip',
    { slipIds: batch.slips.map((s) => s._id), month: batch.month, year: batch.year },
    { responseType: 'blob' }
  )
  return data
}

// ---- the employee's own "salary paid" notice ----

export interface PaidSlipNotice {
  _id: string
  startDate: string
  endDate: string
  netPayable: number
  paidAt?: string
  transactionDetails?: { mode?: string; referenceNumber?: string; paidOn?: string; note?: string }
  paymentReceiptFile?: { filename?: string }
}

export async function listMyPaidSalaryNotices() {
  const { data } = await apiClient.get<{ slips: PaidSlipNotice[] }>('/salary-slips/mine/paid-unseen')
  return data.slips
}

export async function closePaidSalaryNotice(id: string) {
  await apiClient.post(`/salary-slips/${id}/paid-seen`)
}

export async function fetchSalaryReceipt(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/salary-slips/${id}/payment-receipt`, { responseType: 'blob' })
  return data
}
