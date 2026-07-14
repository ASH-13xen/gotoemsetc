import { apiClient } from './client'

export interface ActivityLogEntry {
  _id: string
  action: string
  actorType: 'admin' | 'client-link'
  metadata?: Record<string, unknown>
  createdAt: string
}

export async function listActivity(clientId: string): Promise<{ activityLog: ActivityLogEntry[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/activity`)
  return data
}
