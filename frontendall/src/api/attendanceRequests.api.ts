import { apiClient } from './client'

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
  // with no other type set. See AttendanceModificationRequest.js.
  requestedEarlyDeparture?: boolean
  // Which tier must act next, while status is still 'pending'. Always 'hr'
  // for a free-text (frontendems) request — the two-stage flow only ever
  // applies to a structured leave application. See
  // attendanceRequest.service.js#resolveApprovalStage.
  approvalStage: AttendanceRequestApprovalStage
  cmApprovedAt?: string
  status: AttendanceRequestStatus
  rejectionReason?: string
  resolvedAt?: string
  revokedAt?: string
  createdAt: string
}

// The structured counterpart to frontendems's free-text
// "Request Modification" flow — same backend request/resolve pipeline, this
// one always carries requestedStatus and/or requestedEarlyDeparture so it
// can be reviewed as an actual leave application rather than a plain
// correction ask. `endDate` lets the same single-day request shape cover a
// multi-day span — the backend applies the final resolution uniformly
// across every day in [date, endDate] once HR gives the final approval.
export async function createLeaveApplication(input: {
  date: string
  endDate: string
  reason: string
  requestedStatus?: LeaveApplicationStatus
  requestedEarlyDeparture?: boolean
}): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post('/attendance-requests', input)
  return data
}

// The Content Manager's "pending my review" dashboard queue — requests from
// anyone on a team they're tagged content_manager on, still sitting at the
// content_manager stage.
export async function listMyPendingCmReviews(): Promise<{ requests: AttendanceModificationRequest[] }> {
  const { data } = await apiClient.get('/attendance-requests/mine/pending-cm-review')
  return data
}

// Advances a request from the content_manager stage to the hr stage — the
// Content Manager's approval action. Rejecting reuses the existing reject
// endpoint (see rejectAttendanceRequest-equivalent below), same as HR.
export async function cmApproveRequest(id: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/cm-approve`)
  return data
}

export async function rejectAttendanceRequest(id: string, reason?: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/reject`, { reason })
  return data
}

export async function listMyUnseenAttendanceOutcomes(): Promise<{ requests: AttendanceModificationRequest[] }> {
  const { data } = await apiClient.get('/attendance-requests/mine/unseen')
  return data
}

export async function acknowledgeAttendanceRequest(id: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/acknowledge`)
  return data
}

// Drives whether "Apply for Paid Leave" even shows up as an option — a
// worker who's already used (or has a pending/resolved application for)
// their one paid leave in `date`'s month is not offered it at all.
export async function getPaidLeaveEligibility(date?: string): Promise<{ eligible: boolean }> {
  const { data } = await apiClient.get('/attendance-requests/paid-leave-eligibility', { params: { date } })
  return data
}
