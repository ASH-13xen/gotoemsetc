import { apiClient } from './client'

export interface TaskEvent {
  _id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface TaskEventInput {
  name: string
  description?: string
}

export async function listTaskEvents(): Promise<{ events: TaskEvent[] }> {
  const { data } = await apiClient.get('/task-events')
  return data
}

export async function createTaskEvent(input: TaskEventInput): Promise<{ event: TaskEvent }> {
  const { data } = await apiClient.post('/task-events', input)
  return data
}

export async function updateTaskEvent(id: string, input: Partial<TaskEventInput>): Promise<{ event: TaskEvent }> {
  const { data } = await apiClient.patch(`/task-events/${id}`, input)
  return data
}

export async function deleteTaskEvent(id: string): Promise<void> {
  await apiClient.delete(`/task-events/${id}`)
}
