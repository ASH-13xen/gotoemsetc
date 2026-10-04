import { apiClient } from './client'

// HR's requests to change attendance more than 2 days old — only the CEO and
// admin see and decide them (backend attendanceEditRequest.service.js).

export type EditRequestStatus = 'pending' | 'approved' | 'rejected'

export interface EditRequestChange {
  status?: string
  overtimeMinutes?: number
  isLate?: boolean
  earlyDeparture?: boolean
}

export interface AttendanceEditRequest {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string; employeeCode?: string; designation?: string }
  date: string
  change: EditRequestChange
  reason: string
  previous: (EditRequestChange & { status: string | null }) | null
  requestedBy: { _id: string; username: string; role: string }
  status: EditRequestStatus
  decidedBy?: { _id: string; username: string; role: string }
  decidedAt?: string
  decisionNote?: string
  createdAt: string
}

export async function listEditRequests(status?: EditRequestStatus) {
  const { data } = await apiClient.get<{ requests: AttendanceEditRequest[] }>('/attendance-edit-requests', { params: status ? { status } : {} })
  return data.requests
}

export async function approveEditRequest(id: string, note?: string) {
  const { data } = await apiClient.post<{ request: AttendanceEditRequest }>(`/attendance-edit-requests/${id}/approve`, { note })
  return data.request
}

export async function rejectEditRequest(id: string, note?: string) {
  const { data } = await apiClient.post<{ request: AttendanceEditRequest }>(`/attendance-edit-requests/${id}/reject`, { note })
  return data.request
}
