import { apiClient } from './client'
import type { TaskStage } from './tasks.api'

export interface PipelineLogEntry {
  _id: string
  stage: TaskStage
  customLabel?: string
  note: string
  sourceTask?: string
  taskDate?: string
  loggedByName?: string
  createdAt: string
}

export interface PipelineLogResponse {
  stages: Record<Exclude<TaskStage, 'custom'>, PipelineLogEntry[]>
  others: { label: string; entries: PipelineLogEntry[] }[]
}

export interface CreatePipelineLogInput {
  client: string
  stage: TaskStage
  customLabel?: string
  note: string
}

export async function getPipelineLog(clientId: string): Promise<PipelineLogResponse> {
  const { data } = await apiClient.get('/pipeline-log', { params: { client: clientId } })
  return data
}

export async function createPipelineLogEntry(
  input: CreatePipelineLogInput
): Promise<{ entry: PipelineLogEntry }> {
  const { data } = await apiClient.post('/pipeline-log', input)
  return data
}
