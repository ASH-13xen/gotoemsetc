import { apiClient } from './client'

export interface TaskClientTeamRef {
  _id: string
  name: string
}

export interface TaskClient {
  _id: string
  name: string
  logoUrl?: string
  // The team that handles this client's work by default — auto-selected
  // when a Client task is created for this client.
  defaultTeam?: TaskClientTeamRef | null
  createdAt: string
  updatedAt: string
}

export interface TaskClientInput {
  name: string
  defaultTeam?: string | null
}

export async function listTaskClients(): Promise<{ clients: TaskClient[] }> {
  const { data } = await apiClient.get('/task-clients')
  return data
}

export async function createTaskClient(input: TaskClientInput): Promise<{ client: TaskClient }> {
  const { data } = await apiClient.post('/task-clients', input)
  return data
}

export async function updateTaskClient(id: string, input: TaskClientInput): Promise<{ client: TaskClient }> {
  const { data } = await apiClient.patch(`/task-clients/${id}`, input)
  return data
}

export async function deleteTaskClient(id: string): Promise<void> {
  await apiClient.delete(`/task-clients/${id}`)
}

export async function uploadTaskClientLogo(id: string, file: File): Promise<{ client: TaskClient }> {
  const formData = new FormData()
  formData.append('logo', file)
  const { data } = await apiClient.post(`/task-clients/${id}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
