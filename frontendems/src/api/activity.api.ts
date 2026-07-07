import { apiClient } from './client'

export interface ActivityLogEntry {
  _id: string
  action: string
  actorType: 'admin' | 'employee-link'
  metadata?: Record<string, unknown>
  createdAt: string
}

export async function listActivity(employeeId: string): Promise<{ activityLog: ActivityLogEntry[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/activity`)
  return data
}
