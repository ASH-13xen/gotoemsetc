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
