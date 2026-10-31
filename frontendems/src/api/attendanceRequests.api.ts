import { apiClient } from './client'
import type { AttendanceStatus } from './attendance.api'

export type AttendanceRequestStatus = 'pending' | 'resolved' | 'rejected' | 'revoked'

export interface AttendanceModificationRequest {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string } | string
  date: string
  // Inclusive end of a multi-day leave application (same as date otherwise).
  endDate?: string
  reason: string
  // What they applied for — from frontendall's "apply for leave" or the
  // correction form here ('P' = a correction to Present). Only requests made
  // before every request had a type lack it.
  requestedStatus?: RequestedStatus
  // Set only when requestedStatus is 'H' — which half of the day.
  requestedHalfDayPeriod?: HalfDayPeriod
  // The "Multiple Days" type — a general, uncapped multi-day leave request
  // with no requestedStatus set at all.
  requestedMultiDayLeave?: boolean
  // Evening "Short Leave (2nd half)" — see frontendall's ApplyLeaveDialog.
  requestedEarlyDeparture?: boolean
  // Which tier must act next while pending — Unpaid Leave ends at 'ceo'.
  approvalStage?: 'content_manager' | 'hr' | 'ceo'
  status: AttendanceRequestStatus
  rejectionReason?: string
  resolvedBy?: string
  resolvedAt?: string
  revokedBy?: string
  revokedAt?: string
  createdAt: string
}

export type RequestedStatus = 'SL' | 'L' | 'H' | 'O' | 'W' | 'P'
export type HalfDayPeriod = 'first_half' | 'second_half'

export interface CreateAttendanceRequestInput {
  date: string
  reason: string
  requestedStatus?: RequestedStatus
  requestedHalfDayPeriod?: HalfDayPeriod
  requestedEarlyDeparture?: boolean
}

export async function createAttendanceRequest(
  input: CreateAttendanceRequestInput
): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post('/attendance-requests', input)
  return data
}

export async function listAttendanceRequests(params?: {
  status?: AttendanceRequestStatus
}): Promise<{ requests: AttendanceModificationRequest[] }> {
  const { data } = await apiClient.get('/attendance-requests', { params })
  return data
}

export async function resolveAttendanceRequest(
  id: string,
  input: { status?: AttendanceStatus; overtimeMinutes?: number; isLate?: boolean }
): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/resolve`, input)
  return data
}
