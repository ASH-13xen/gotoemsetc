import { apiClient } from './client'

export type AttendanceStatus = 'P' | 'O' | 'H' | 'L' | 'SL' | 'W'

export interface AttendanceRecord {
  _id: string
  employee: string
  date: string
  status?: AttendanceStatus
  overtimeHours: number
  isBackdated: boolean
  // True when the daily biometric classifier wrote this record rather than
  // an admin — an admin save always flips this back to false.
  isAutoMarked: boolean
  // Independent of status — arrival past the grace cutoff, can coexist with
  // any status (e.g. Short Leave AND late on the same day).
  isLate: boolean
  // True when this record was last updated via an attendance modification
  // request resolution.
  modifiedByRequest: boolean
  // Departure-side Short Leave (left early) — independent of status, can
  // coexist with an arrival-side status: 'SL'/'H' (two short leaves in one day).
  earlyDeparture: boolean
  // False while the day is still provisional (real-time classification
  // could still revise it later today); true once finalized.
  isSettled: boolean
  notes?: string
}

export async function markAttendance(
  employeeId: string,
  date: string,
  input: {
    status?: AttendanceStatus
    overtimeHours?: number
    isLate?: boolean
    earlyDeparture?: boolean
    notes?: string
  }
): Promise<{ record: AttendanceRecord }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/attendance`, {
    date,
    ...input,
  })
  return data
}

export async function listAttendance(
  employeeId: string,
  month: number,
  year: number
): Promise<{ records: AttendanceRecord[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/attendance`, {
    params: { month, year },
  })
  return data
}

// Every working day in [from, to] (or, with neither given, date of joining
// through today), split into unmarked vs. each status — plus the Late/SL/
// Half-Day conversion breakdown so a stacked day's true payroll impact is
// visible, not just its arrival-side status.
export interface AttendanceSummary {
  dateOfJoining: string | null
  asOfDate: string
  // The actual start of the counted range — equals date of joining for
  // "Overall", but for Current/Previous Month this is clamped forward to
  // date of joining if the calendar month started before they were hired
  // (so a pre-employment period never gets counted as unmarked working days).
  periodStart: string
  totalWorkingDays: number
  unmarkedDays: number
  counts: Record<AttendanceStatus, number>
  lateFlagCount: number
  earlyDepartureCount: number
  lateToSLUnits: number
  effectiveSLUnits: number
  halfDayPenaltyUnits: number
}

export async function getAttendanceSummary(
  employeeId: string,
  range?: { from?: string; to?: string }
): Promise<{ summary: AttendanceSummary }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/attendance/summary`, {
    params: range,
  })
  return data
}

// Employee ids that already have today's attendance marked — drives the
// Attendance page's "already marked" badge and bottom-of-list sort.
export async function getAttendanceMarkedToday(): Promise<{ employeeIds: string[] }> {
  const { data } = await apiClient.get('/employees/attendance-today')
  return data
}
