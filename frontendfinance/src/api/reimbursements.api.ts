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

export async function markReimbursementPaid(
  id: string,
  input: TransactionDetails
): Promise<{ reimbursement: Reimbursement }> {
  const { data } = await apiClient.post(`/reimbursements/${id}/mark-paid`, input)
  return data
}

export async function downloadReceiptBlob(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/reimbursements/${id}/receipt`, { responseType: 'blob' })
  return data
}
