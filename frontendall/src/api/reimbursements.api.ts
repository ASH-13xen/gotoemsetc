import { apiClient } from './client'
import type { EmployeeSummary } from './employees.api'
import type { ClientSummary } from './clients.api'

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

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  cab: 'Ola / Rapido / Uber',
  bike_petrol: 'Bike / Petrol',
}

export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface Reimbursement {
  _id: string
  employee: EmployeeSummary
  category: ReimbursementCategory
  travelMode?: TravelMode
  client?: ClientSummary
  clientBrandName?: string
  expenseDate: string
  startAt?: string
  endAt?: string
  description: string
  peopleInvolved: EmployeeSummary[]
  amount: number
  status: ReimbursementStatus
  rejectionReason?: string
  createdAt: string
}

export interface FileReimbursementInput {
  category: ReimbursementCategory
  travelMode?: TravelMode
  client?: string
  clientBrandName?: string
  expenseDate: string
  startAt?: string
  endAt?: string
  description: string
  peopleInvolved?: string[]
  amount: number
}

export async function fileReimbursement(input: FileReimbursementInput): Promise<{ reimbursement: Reimbursement }> {
  const { data } = await apiClient.post('/reimbursements', input)
  return data
}

export async function uploadReceipt(id: string, file: File): Promise<{ reimbursement: Reimbursement }> {
  const formData = new FormData()
  formData.append('receipt', file)
  const { data } = await apiClient.post(`/reimbursements/${id}/receipt`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listMyReimbursements(): Promise<{ reimbursements: Reimbursement[] }> {
  const { data } = await apiClient.get('/reimbursements/mine')
  return data
}
