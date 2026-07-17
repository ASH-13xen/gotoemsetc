import { apiClient } from './client'
import type { AttendanceStatus } from './attendance.api'

export type AttendanceRequestStatus = 'pending' | 'resolved'

export interface AttendanceModificationRequest {
  _id: string
  employee: { _id: string; firstName: string; lastName?: string } | string
  date: string
  reason: string
  status: AttendanceRequestStatus
  resolvedBy?: string
  resolvedAt?: string
  createdAt: string
}

export async function createAttendanceRequest(input: {
  date: string
  reason: string
}): Promise<{ request: AttendanceModificationRequest }> {
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
  input: { status?: AttendanceStatus; overtimeHours?: number; isLate?: boolean }
): Promise<{ request: AttendanceModificationRequest }> {
  const { data } = await apiClient.post(`/attendance-requests/${id}/resolve`, input)
  return data
}
