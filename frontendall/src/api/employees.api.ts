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
// needs for Inventory bookings and Event responsibilities.
export async function listEmployeeDirectory(): Promise<EmployeeSummary[]> {
  const { data } = await apiClient.get('/employees', { params: { limit: 100, status: 'active' } })
  return data.items ?? []
}
