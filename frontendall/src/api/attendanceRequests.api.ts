import { apiClient } from './client'

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

// Only Work From Home may span multiple days — every other leave type
// (including a plain Paid Leave and Early Departure) is a single-day ask.
// Mirrors SINGLE_DAY_ONLY_STATUSES in
// backend/src/validators/attendanceRequest.validator.js.
export function isRangeEligible(status: LeaveApplicationStatus | undefined) {
  return status === 'W'
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
  // Set only when requestedStatus is 'H' — which half of the day. See
  // AttendanceModificationRequest.js.
  requestedHalfDayPeriod?: HalfDayPeriod
  // Independent of requestedStatus — an application can request just this,
  // with no other type set. See AttendanceModificationRequest.js.
  requestedEarlyDeparture?: boolean
  // The "Multiple Days" type — a general, uncapped multi-day leave request
  // with no specific requestedStatus. Independent of every field above, same
  // pattern as requestedEarlyDeparture. See AttendanceModificationRequest.js.
  requestedMultiDayLeave?: boolean
  // Which tier must act next, while status is still 'pending'. Always 'hr'
  // for a free-text (frontendems) request — the two-stage flow only ever
  // applies to a structured leave application. See
  // attendanceRequest.service.js#resolveApprovalStage.
  approvalStage: AttendanceRequestApprovalStage
  cmApprovedAt?: string
  hrApprovedAt?: string
  // Attached by the list endpoints for structured leave applications only.
  monthlyCounts?: MonthlyLeaveCounts
  status: AttendanceRequestStatus
  rejectionReason?: string
  resolvedAt?: string
  revokedAt?: string
  // Set once the employee ticks a decided application off their dashboard
  // card — it then shows only under "Show all leave applications".
  dashboardAcknowledgedAt?: string | null
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
  requestedHalfDayPeriod?: HalfDayPeriod
  requestedEarlyDeparture?: boolean
  requestedMultiDayLeave?: boolean
}): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post('/attendance-requests', input)
  return data
}

// Every attendance/leave request this employee has ever filed, any status.
// `mine` keeps it to their own even for someone with HR-level access, who
// would otherwise get everyone's (see
// backend/src/controllers/attendanceRequest.controller.js#list). The
// employee is taken from the login on the server — no id is passed from here.
export async function listMyAttendanceRequests(): Promise<{ requests: AttendanceModificationRequest[] }> {
  const { data } = await apiClient.get('/attendance-requests', { params: { mine: true } })
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

export async function acknowledgeLeaveApplicationOnDashboard(id: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/dashboard-acknowledge`)
  return data
}

export async function acknowledgeAttendanceRequest(id: string): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/acknowledge`)
  return data
}

// Drives whether "Apply for Paid Leave" even shows up as an option — a
// worker who's already used (or has a pending/resolved application for)
// their one paid leave in `date`'s month is not offered it at all.
export async function getPaidLeaveEligibility(
  date?: string
): Promise<{ eligible: boolean; reason: 'probation' | 'already_used' | null }> {
  const { data } = await apiClient.get('/attendance-requests/paid-leave-eligibility', { params: { date } })
  return data
}

export async function getMyMonthlyLeaveCounts(date?: string): Promise<{ counts: MonthlyLeaveCounts | null }> {
  const { data } = await apiClient.get('/attendance-requests/monthly-counts', { params: { date } })
  return data
}
