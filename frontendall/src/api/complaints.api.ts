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
  category: ComplaintCategory
  description: string
  status: ComplaintStatus
  createdAt: string
  completedAt?: string
}

// Employee identity is derived server-side from the logged-in account
// (req.user.employeeLink) — never sent from here.
export async function fileComplaint(input: { category: ComplaintCategory; description: string }): Promise<{ complaint: Complaint }> {
  const { data } = await apiClient.post('/complaints', input)
  return data
}

// This employee's own complaints currently sitting at 'completed' — i.e.
// awaiting their speed/quality review.
export async function listMyComplaintsAwaitingReview(): Promise<{ complaints: Complaint[] }> {
  const { data } = await apiClient.get('/complaints/mine/awaiting-review')
  return data
}

export async function submitComplaintReview(
  id: string,
  input: { speedRating: number; qualityRating: number; comments?: string }
): Promise<{ complaint: Complaint }> {
  const { data } = await apiClient.post(`/complaints/${id}/review`, input)
  return data
}
