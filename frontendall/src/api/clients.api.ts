import { apiClient } from './client'

// The client registry shared by Task Management and the Client Management
// System. An event optionally links to one of these — see EventFormDialog.
// (This used to read the old CRM `Client` model, removed in the CMS rebuild.)
export interface ClientSummary {
  _id: string
  name: string
  logoUrl?: string
}

export async function listClients(): Promise<ClientSummary[]> {
  const { data } = await apiClient.get('/task-clients')
  return data.clients ?? []
}
