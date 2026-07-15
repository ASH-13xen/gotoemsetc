import { apiClient } from './client'
import type { EmployeeRef } from './tasks.api'

export interface ClientChatMessage {
  _id: string
  client: string
  // Absent when posted by an admin account with no linked Employee record.
  sender?: EmployeeRef | null
  body: string
  createdAt: string
}

export async function listClientChatMessages(clientId: string): Promise<{ messages: ClientChatMessage[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/chat/messages`)
  return data
}

export async function postClientChatMessage(clientId: string, body: string): Promise<{ message: ClientChatMessage }> {
  const { data } = await apiClient.post(`/clients/${clientId}/chat/messages`, { body })
  return data
}

// Admin-only — the chat roster is independent of task assignment.
export async function updateClientChatAccess(
  clientId: string,
  chatAllowedEmployees: string[]
): Promise<{ client: { _id: string; chatAllowedEmployees: EmployeeRef[] } }> {
  const { data } = await apiClient.patch(`/clients/${clientId}/chat/access`, { chatAllowedEmployees })
  return data
}
