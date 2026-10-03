import { apiClient } from './client'
import type { AttendanceStatus } from './attendance.api'

export type AttendanceRequestStatus = 'pending' | 'resolved' | 'rejected' | 'revoked'
export type AttendanceRequestApprovalStage = 'content_manager' | 'hr' | 'ceo'
export type LeaveApplicationStatus = 'SL' | 'L' | 'H' | 'O' | 'W'
export type HalfDayPeriod = 'first_half' | 'second_half'

export const LEAVE_APPLICATION_STATUS_LABEL: Record<LeaveApplicationStatus, string> = {
  SL: 'Short Leave',
  L: 'Late',
  H: 'Half Day',
  O: 'Paid Leave',
  W: 'Work From Home',
}

export const HALF_DAY_PERIOD_LABEL: Record<HalfDayPeriod, string> = {
  first_half: 'First Half (9:30 AM – 2:00 PM)',
  second_half: 'Second Half (2:00 PM – 6:30 PM)',
}

// Short Leave is applied for by half too, but unlike Half Day the two
// halves map to different things on the attendance record: a first-half
// (morning) Short Leave is a plain status 'SL', while a second-half
// (evening) one is the earlyDeparture flag — which payroll already counts
// as a Short Leave. So the period isn't stored; the dialog just picks
// requestedStatus: 'SL' or requestedEarlyDeparture: true from it.
export const SHORT_LEAVE_PERIOD_LABEL: Record<HalfDayPeriod, string> = {
  first_half: 'First Half (before 11:30 AM)',
  second_half: 'Second Half (4:30 PM – 6:30 PM)',
}

export const SHORT_LEAVE_SECOND_HALF_LABEL = 'Short Leave (2nd half)'
export const UNPAID_LEAVE_LABEL = 'Unpaid Leave'

// The one name for what an employee applied for, shared by every screen
// that lists leave applications. An evening Short Leave is stored as
// requestedEarlyDeparture (see SHORT_LEAVE_PERIOD_LABEL), and "Unpaid Leave"
// is requestedMultiDayLeave.
export function leaveApplicationLabel(request: {
  requestedStatus?: LeaveApplicationStatus
  requestedEarlyDeparture?: boolean
  requestedMultiDayLeave?: boolean
}) {
  const parts: string[] = []
  if (request.requestedStatus) parts.push(LEAVE_APPLICATION_STATUS_LABEL[request.requestedStatus])
  if (request.requestedMultiDayLeave) parts.push(UNPAID_LEAVE_LABEL)
  if (request.requestedEarlyDeparture) parts.push(SHORT_LEAVE_SECOND_HALF_LABEL)
  return parts.join(' + ')
}

// Month-to-date tally for the month of a request's date, counted the same
// way payroll does — shortLeave already includes earlyDeparture (broken out
// separately too). `pending` is undecided applications for that month.
export interface MonthlyLeaveCounts {
  late: number
  shortLeave: number
  earlyDeparture: number
  halfDay: number
  pending: { late: number; shortLeave: number; halfDay: number }
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
  // Set only when requestedStatus is 'H' — which half of the day.
  requestedHalfDayPeriod?: HalfDayPeriod
  // Independent of requestedStatus — an application can request just this,
  // with no other type set.
  requestedEarlyDeparture?: boolean
  // The "Multiple Days" type — a general, uncapped multi-day leave request
  // with no specific requestedStatus. Independent of every field above.
  requestedMultiDayLeave?: boolean
  // Which tier must act next, while status is still 'pending'. Always 'hr'
  // for a free-text (frontendems) request. See
  // attendanceRequest.service.js#resolveApprovalStage.
  approvalStage: AttendanceRequestApprovalStage
  cmApprovedAt?: string
  hrApprovedAt?: string
  // Unpaid Leave at the CEO stage — the change HR chose, applied when the
  // CEO approves.
  pendingAttendanceUpdate?: {
    status?: AttendanceStatus
    overtimeMinutes?: number
    isLate?: boolean
    earlyDeparture?: boolean
  } | null
  // Attached by the list endpoint for structured leave applications only.
  monthlyCounts?: MonthlyLeaveCounts
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
