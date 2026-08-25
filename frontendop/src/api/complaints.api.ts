import { apiClient } from './client'

export type ComplaintCategory =
  | 'wifi'
  | 'cleaning'
  | 'electrical'
  | 'carpenter'
  | 'plumber'
  | 'grocery'
  | 'washroom'
  | 'parking'
  | 'others'

export type ComplaintStatus = 'pending' | 'completed' | 'reviewed'

// Keep in sync with backend/src/config/constants.js#COMPLAINT_CATEGORY.
export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  wifi: 'WiFi',
  cleaning: 'Cleaning',
  electrical: 'Electrical',
  carpenter: 'Carpenter',
  plumber: 'Plumber',
  grocery: 'Grocery',
  washroom: 'Washroom',
  parking: 'Parking',
  others: 'Others',
}

export interface Complaint {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string; employeeCode?: string; designation?: string }
  category: ComplaintCategory
  description: string
  status: ComplaintStatus
  createdAt: string
  notifiedAt?: string
  completedAt?: string
  completedBy?: { _id: string; username: string }
  reviewedAt?: string
  feedback?: { speedRating: number; qualityRating: number; comments?: string }
}

export async function listComplaints(status?: ComplaintStatus): Promise<{ complaints: Complaint[] }> {
  const { data } = await apiClient.get('/complaints', { params: status ? { status } : undefined })
  return data
}

// Operations-only — timestamps completedAt/completedBy and notifies the
// filer that it's awaiting their speed/quality review.
export async function markComplaintCompleted(id: string): Promise<{ complaint: Complaint }> {
  const { data } = await apiClient.post(`/complaints/${id}/complete`)
  return data
}
