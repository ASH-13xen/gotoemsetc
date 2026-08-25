import { apiClient } from './client'

export interface EmployeeSummary {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

// Same shape and limit convention as frontendfollowups's employee
// directory call — used here to power the assignment pickers this shell
// needs for Inventory bookings and Event responsibilities. Gated behind
// directory-access permissions server-side (admin/hr, or a granted
// permission) — fine for those pickers since they're only ever reached by
// admin/hr already. NOT usable by ceo/operations_manager, who hold no
// permissions — see listOpenEmployeeDirectory below for that case.
export async function listEmployeeDirectory(): Promise<EmployeeSummary[]> {
  const { data } = await apiClient.get('/employees', { params: { limit: 100, status: 'active' } })
  return data.items ?? []
}

// The genuinely open counterpart — GET /employees/directory has no
// permission gate at all (see backend/src/routes/employee.routes.js), so
// this is safe to call from any authenticated account, including
// ceo/operations_manager for the Office Keys assign picker.
export async function listOpenEmployeeDirectory(): Promise<EmployeeSummary[]> {
  const { data } = await apiClient.get('/employees/directory')
  return data.items ?? []
}

export type FlagColor = 'red' | 'green'

export interface FlagHistoryEntry {
  _id: string
  employeeId: string
  employeeName: string
  employeeCode?: string
  color: FlagColor
  note: string
  date: string
}

// Backs the Performance Flags page — admin/hr/ceo only (see
// backend/src/routes/employee.routes.js's GET /flags/history).
export async function getFlagHistory(): Promise<{ entries: FlagHistoryEntry[] }> {
  const { data } = await apiClient.get('/employees/flags/history')
  return data
}
