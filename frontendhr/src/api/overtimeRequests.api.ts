import { apiClient } from './client'

// Overtime has to be approved before it counts — the content manager first
// (when the person has one who can act), then HR. See backend
// overtimeRequest.service.js and approvalRouting.service.js.

export type OvertimeStatus = 'pending' | 'approved' | 'rejected'
export type OvertimeStage = 'content_manager' | 'hr'

export interface OvertimeRequestItem {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string; employeeCode?: string; designation?: string }
  date: string
  // What the scans worked out, and what the employee applied for (if they did).
  biometricMinutes: number
  appliedMinutes: number | null
  employeeReason?: string
  stage: OvertimeStage
  status: OvertimeStatus
  cmMinutes: number | null
  cmReason?: string
  cmApprovedAt?: string
  cmApprovedByName: string | null
  approvedMinutes: number | null
  hrNote?: string
  rejectedStage?: OvertimeStage | null
  rejectionReason?: string
  decidedAt?: string
  // Who decided — only when this viewer may see it.
  decidedByInfo?: { name: string; asLabel: string | null }
  // Their own overtime — someone else has to decide it.
  isOwn: boolean
  suggestedMinutes: number
  createdAt: string
}

export async function listOvertimeRequests(params: { status?: OvertimeStatus; month?: number; year?: number }) {
  const { data } = await apiClient.get<{ requests: OvertimeRequestItem[] }>('/overtime-requests/all', { params })
  return data.requests
}

export async function approveOvertime(id: string, input: { minutes: number; note?: string }) {
  const { data } = await apiClient.post(`/overtime-requests/${id}/approve`, input)
  return data
}

export async function rejectOvertime(id: string, reason: string) {
  const { data } = await apiClient.post(`/overtime-requests/${id}/reject`, { reason })
  return data
}
