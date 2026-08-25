import { apiClient } from './client'

// Read-only view into the shared EMS employee directory — used to pick
// meeting attendees. Employee records themselves are owned/managed by EMS.
export interface EmployeeSummary {
  _id: string
  employeeCode: string
  firstName: string
  lastName?: string
  designation: string
}

export interface ListEmployeesResponse {
  items: EmployeeSummary[]
  total: number
}

export async function listEmployees(search?: string): Promise<ListEmployeesResponse> {
  const { data } = await apiClient.get('/employees', { params: { search, limit: 100 } })
  return data
}

// GET /employees is gated (admin/HR or a granted permission) and would 403
// for a CEO or global-Team-Leader account, both of whom hold zero
// permissions by design (see backend/src/config/constants.js) — the same
// gap Office Keys hit in frontendall. GET /employees/directory has no
// permission gate at all, so this is what "assign to anyone, team or
// outside" pickers should use instead.
export async function listOpenEmployeeDirectory(): Promise<EmployeeSummary[]> {
  const { data } = await apiClient.get('/employees/directory')
  return data.items ?? []
}
