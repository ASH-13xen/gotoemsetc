import { apiClient } from './client'
import type { AttendanceStatus } from './attendance.api'

export type AttendanceRequestStatus = 'pending' | 'resolved' | 'rejected' | 'revoked'
export type AttendanceRequestApprovalStage = 'content_manager' | 'hr'
export type LeaveApplicationStatus = 'SL' | 'L' | 'H' | 'O' | 'W'

export const LEAVE_APPLICATION_STATUS_LABEL: Record<LeaveApplicationStatus, string> = {
  SL: 'Short Leave',
  L: 'Late',
  H: 'Half Day',
  O: 'Leave',
  W: 'Work From Home',
}

export interface AttendanceModificationRequest {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string } | string
  date: string
  // Inclusive end of the span — equal to `date` for a plain single-day
  // request, later for a multi-day leave application.
  endDate: string
  reason: string
  requestedStatus?: LeaveApplicationStatus
  // Independent of requestedStatus — an application can request just this,
  // with no other type set.
  requestedEarlyDeparture?: boolean
  // Which tier must act next, while status is still 'pending'. Always 'hr'
  // for a free-text (frontendems) request. See
  // attendanceRequest.service.js#resolveApprovalStage.
  approvalStage: AttendanceRequestApprovalStage
  cmApprovedAt?: string
  status: AttendanceRequestStatus
  rejectionReason?: string
  resolvedAt?: string
  revokedAt?: string
  createdAt: string
}

export async function listAttendanceRequests(params?: {
  status?: AttendanceRequestStatus
}): Promise<{ requests: AttendanceModificationRequest[] }> {
  const { data } = await apiClient.get('/attendance-requests', { params })
  return data
}

export async function resolveAttendanceRequest(
  id: string,
  input: { status?: AttendanceStatus; overtimeMinutes?: number; isLate?: boolean; earlyDeparture?: boolean }
): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/resolve`, input)
  return data
}

export async function rejectAttendanceRequest(
  id: string,
  reason?: string
): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/reject`, { reason })
  return data
}

// Non-destructive on the backend — restores (or unmarks) the date's
// AttendanceRecord rather than deleting anything. Only valid on a request
// currently 'resolved'.
export async function revokeAttendanceRequest(id: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/revoke`)
  return data
}
