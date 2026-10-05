import { apiClient } from './client'
import type { SlipEmployeeRef, TransactionDetails } from './salarySlips.api'

export type ReimbursementCategory =
  | 'client_work'
  | 'grocery'
  | 'travel'
  | 'stationery'
  | 'influencer'
  | 'camera_accessories'
  | 'meta_ads'
  | 'miscellaneous'

export const CATEGORY_LABEL: Record<ReimbursementCategory, string> = {
  client_work: 'Client Work',
  grocery: 'Grocery',
  travel: 'Travel',
  stationery: 'Stationery',
  influencer: 'Influencer',
  camera_accessories: 'Camera / Accessories',
  meta_ads: 'Meta Ads',
  miscellaneous: 'Miscellaneous',
}

export type TravelMode = 'cab' | 'bike_petrol'
export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface Reimbursement {
  _id: string
  employee: SlipEmployeeRef
  category: ReimbursementCategory
  travelMode?: TravelMode
  client?: { _id: string; name: string }
  clientBrandName?: string
  expenseDate: string
  startAt?: string
  endAt?: string
  description: string
  peopleInvolved: SlipEmployeeRef[]
  amount: number
  status: ReimbursementStatus
  rejectionReason?: string
  receiptFile?: { filename?: string }
  // Finance's screenshot of the payment, shown to the claimant.
  paymentProofFile?: { filename?: string }
  createdAt: string
}

export async function listReimbursements(status?: ReimbursementStatus): Promise<{ reimbursements: Reimbursement[] }> {
  const { data } = await apiClient.get('/reimbursements', { params: status ? { status } : undefined })
  return data
}

export async function approveReimbursement(id: string): Promise<{ reimbursement: Reimbursement }> {
  const { data } = await apiClient.post(`/reimbursements/${id}/approve`)
  return data
}

export async function rejectReimbursement(id: string, reason: string): Promise<{ reimbursement: Reimbursement }> {
  const { data } = await apiClient.post(`/reimbursements/${id}/reject`, { reason })
  return data
}

// Sent as multipart: the transaction details as fields plus the payment
// screenshot as `proof` (required by the backend).
export async function markReimbursementPaid(
  id: string,
  input: TransactionDetails,
  proof: File
): Promise<{ reimbursement: Reimbursement }> {
  const formData = new FormData()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') formData.append(key, String(value))
  }
  formData.append('proof', proof)
  const { data } = await apiClient.post(`/reimbursements/${id}/mark-paid`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function downloadPaymentProofBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/reimbursements/${id}/payment-proof`, { responseType: 'blob' })
  return data
}

export async function downloadReceiptBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/reimbursements/${id}/receipt`, { responseType: 'blob' })
  return data
}
