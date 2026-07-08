import { apiClient } from './client'
import type { MeetingAttendee } from './meetings.api'

export type TaskStage = 'plan_of_action' | 'post' | 'shoot' | 'edit' | 'design' | 'calendar' | 'report' | 'custom'

export const PIPELINE_STAGES: { value: TaskStage; label: string }[] = [
  { value: 'plan_of_action', label: 'Plan of Action' },
  { value: 'post', label: 'Post' },
  { value: 'shoot', label: 'Shoot' },
  { value: 'edit', label: 'Edit' },
  { value: 'design', label: 'Design' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'report', label: 'Report' },
]

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskAssigneeTeam {
  _id: string
  name: string
}

export interface TaskCommentAuthor {
  _id: string
  username: string
  role: 'admin' | 'worker'
  employeeLink?: string
}

export interface TaskComment {
  _id: string
  author: TaskCommentAuthor
  body: string
  createdAt: string
}

export interface TaskAttachment {
  _id: string
  url: string
  publicId: string
  resourceType: string
  originalFilename?: string
  mimeType?: string
  sizeBytes?: number
  createdAt: string
}

export interface TaskClient {
  _id: string
  clientName: string
  brandName: string
}

export interface Task {
  _id: string
  title: string
  description?: string
  client: TaskClient
  stage: TaskStage
  customLabel?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  assigneeEmployees: MeetingAttendee[]
  assigneeTeam?: TaskAssigneeTeam
  summary?: string
  comments: TaskComment[]
  attachments: TaskAttachment[]
  createdAt: string
  updatedAt: string
}

export interface ListTasksParams {
  client?: string
  stage?: TaskStage
  status?: TaskStatus
  assignee?: string
  priority?: TaskPriority
  search?: string
  page?: number
  limit?: number
}

export interface ListTasksResponse {
  items: Task[]
  total: number
  page: number
  limit: number
}

export interface CreateTaskInput {
  title: string
  description?: string
  client: string
  stage?: TaskStage
  customLabel?: string
  priority?: TaskPriority
  dueDate?: string
  assigneeEmployees?: string[]
  assigneeTeam?: string
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'client'>>

export interface DueSummaryItem {
  _id: string
  title: string
  priority: TaskPriority
  dueDate: string
}

export async function listTasks(params: ListTasksParams): Promise<ListTasksResponse> {
  const { data } = await apiClient.get('/tasks', { params })
  return data
}

export async function getTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.get(`/tasks/${id}`)
  return data
}

export async function createTask(input: CreateTaskInput): Promise<{ task: Task }> {
  const { data } = await apiClient.post('/tasks', input)
  return data
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<{ task: Task }> {
  const { data } = await apiClient.patch(`/tasks/${id}`, input)
  return data
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  summary?: string
): Promise<{ task: Task }> {
  const { data } = await apiClient.patch(`/tasks/${id}/status`, { status, summary })
  return data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`)
}

export async function addComment(id: string, body: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post(`/tasks/${id}/comments`, { body })
  return data
}

export async function uploadAttachment(id: string, file: File): Promise<{ task: Task }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post(`/tasks/${id}/attachments`, formData)
  return data
}

export async function removeAttachment(id: string, attachmentId: string): Promise<{ task: Task }> {
  const { data } = await apiClient.delete(`/tasks/${id}/attachments/${attachmentId}`)
  return data
}

export async function getDueSummary(clientIds: string[]): Promise<{ items: DueSummaryItem[] }> {
  const { data } = await apiClient.get('/tasks/due-summary', { params: { clients: clientIds.join(',') } })
  return data
}
