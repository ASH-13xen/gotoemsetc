import { apiClient } from './client'

export interface ClientSummary {
  _id: string
  clientName: string
  brandName: string
}

export interface ClientTaskSummary {
  _id: string
  itemLabel: string
  sectionName: string
}

export async function listClients(): Promise<ClientSummary[]> {
  const { data } = await apiClient.get('/clients', { params: { limit: 100 } })
  return data.items ?? []
}

// Current cycle's tasks for a client — used by the inventory booking
// dialog's "which task" picker. A 403 here means the signed-in employee
// isn't assigned to that client; the caller treats that as "no tasks to
// pick from" rather than surfacing an error.
export async function listClientTasks(clientId: string): Promise<ClientTaskSummary[]> {
  const { data } = await apiClient.get(`/clients/${clientId}/tasks`)
  return data.tasks ?? []
}
