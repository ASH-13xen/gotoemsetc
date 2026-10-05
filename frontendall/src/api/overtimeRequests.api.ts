import { apiClient } from './client'

// Overtime has to be approved before it counts — content manager first
// (when the team has one), then HR. See backend overtimeRequest.service.js.

export type OvertimeStatus = 'pending' | 'approved' | 'rejected'
export type OvertimeStage = 'content_manager' | 'hr'

export interface OvertimeRequest {
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
  approvedMinutes: number | null
  hrNote?: string
  rejectedStage?: OvertimeStage | null
  rejectionReason?: string
  createdAt: string
}

// A request as an approver sees it.
export interface OvertimeReviewItem extends OvertimeRequest {
  cmApprovedByName: string | null
  // Their own overtime — someone else has to decide it.
  isOwn: boolean
  suggestedMinutes: number
}

export interface OvertimeQueue {
  isContentManager: boolean
  isHr: boolean
  contentManager: OvertimeReviewItem[]
  hr: OvertimeReviewItem[]
  // HR only, read-only: still waiting on a content manager.
  withContentManager: OvertimeReviewItem[]
}

export async function applyForOvertime(input: { date: string; minutes: number; reason: string }) {
  const { data } = await apiClient.post<{ request: OvertimeRequest }>('/overtime-requests', input)
  return data.request
}

export async function getOvertimeQueue() {
  const { data } = await apiClient.get<OvertimeQueue>('/overtime-requests/pending')
  return data
}

export async function listOvertimeRequestsFor(employeeId: string, params: { month: number; year: number }) {
  const { data } = await apiClient.get<{ requests: Omit<OvertimeRequest, 'employee'>[] }>(`/overtime-requests/employee/${employeeId}`, { params })
  return data.requests
}

export async function cmApproveOvertime(id: string, input: { minutes: number; reason: string }) {
  const { data } = await apiClient.post<{ request: OvertimeRequest }>(`/overtime-requests/${id}/cm-approve`, input)
  return data.request
}

export async function approveOvertime(id: string, input: { minutes: number; note?: string }) {
  const { data } = await apiClient.post<{ request: OvertimeRequest }>(`/overtime-requests/${id}/approve`, input)
  return data.request
}

export async function rejectOvertime(id: string, reason: string) {
  const { data } = await apiClient.post<{ request: OvertimeRequest }>(`/overtime-requests/${id}/reject`, { reason })
  return data.request
}
