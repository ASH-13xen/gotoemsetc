import { apiClient } from './client'

export interface ClientNote {
  _id: string
  client: string
  body: string
  createdBy?: { _id: string; username: string; role: string }
  createdAt: string
}

export async function listNotes(clientId: string): Promise<{ notes: ClientNote[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/notes`)
  return data
}

export async function addNote(clientId: string, body: string): Promise<{ note: ClientNote }> {
  const { data } = await apiClient.post(`/clients/${clientId}/notes`, { body })
  return data
}

export async function deleteNote(clientId: string, noteId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/notes/${noteId}`)
}
