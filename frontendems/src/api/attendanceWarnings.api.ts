import { apiClient } from './client'

export type WarningCategory = 'late' | 'early_departure' | 'half_day' | 'short_leave' | 'absent'

// Keep in sync with backend/src/config/constants.js#ATTENDANCE_WARNING_TEMPLATES.
export const WARNING_TEMPLATES: Record<WarningCategory, string[]> = {
  late: [
    'You arrived late without informing your manager or HR in advance.',
    'This is a repeated instance of uninformed late arrival — please inform HR/your manager beforehand if you expect to be late.',
  ],
  early_departure: [
    'You left before your shift ended without informing your manager or HR in advance.',
    'Repeated uninformed early departure — please seek approval before leaving early.',
  ],
  half_day: [
    'You were marked Half Day without prior information to your manager or HR.',
    'Please inform HR in advance if you plan to work only half a day.',
  ],
  short_leave: [
    'You took a short leave without informing your manager or HR in advance.',
    'Please request short leave in advance rather than after the fact.',
  ],
  absent: [
    'You were absent without informing your manager or HR in advance.',
    'Repeated uninformed absence — please inform HR/your manager as early as possible if you cannot come in.',
  ],
}

export const CATEGORY_LABEL: Record<WarningCategory, string> = {
  late: 'Late',
  early_departure: 'Early Departure',
  half_day: 'Half Day',
  short_leave: 'Short Leave',
  absent: 'Absent',
}

export interface DailyReportRow {
  employee: { _id: string; firstName: string; lastName?: string; designation: string }
  record: {
    status?: string
    overtimeHours: number
    isLate: boolean
    earlyDeparture: boolean
    notes?: string
  }
  // Raw biometric scan times for the day (first/last), not the classifier's
  // filtered subset — null if the employee never scanned at all that day.
  firstPunchAt: string | null
  lastPunchAt: string | null
  provisional: boolean
  alreadyWarned: { message: string; sentBy?: string; sentAt: string } | null
}

export interface DailyReport {
  date: string
  // The last 2 working days as of now (most recent first) — always stable
  // regardless of which one `date` currently points to, so a picker built
  // from this never shifts under the user.
  recentWorkingDays: string[]
  late: DailyReportRow[]
  early_departure: DailyReportRow[]
  half_day: DailyReportRow[]
  short_leave: DailyReportRow[]
  absent: DailyReportRow[]
  present_overtime: DailyReportRow[]
}

export async function getDailyReport(date?: string): Promise<{ report: DailyReport }> {
  const { data } = await apiClient.get('/attendance-warnings/daily-report', { params: { date } })
  return data
}

export async function sendWarning(input: {
  employeeId: string
  date: string
  category: WarningCategory
  message: string
}): Promise<void> {
  await apiClient.post('/attendance-warnings', input)
}

export interface MonthlyWarnings {
  year: number
  month: number
  counts: Record<WarningCategory, number>
  warnings: { _id: string; date: string; category: WarningCategory; message: string; sentBy?: { username: string } }[]
}

export async function getMonthlyWarnings(employeeId: string, year: number, month: number): Promise<MonthlyWarnings> {
  const { data } = await apiClient.get(`/attendance-warnings/employee/${employeeId}/monthly`, {
    params: { year, month },
  })
  return data
}

export interface PendingWarning {
  notificationId: string
  category: WarningCategory
  date: string
  message: string
  countThisMonth: number
}

export async function getPendingWarnings(): Promise<{ warnings: PendingWarning[] }> {
  const { data } = await apiClient.get('/attendance-warnings/pending')
  return data
}
