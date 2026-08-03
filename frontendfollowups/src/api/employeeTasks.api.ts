import { apiClient } from './client'
import type { EmployeeSummary } from './employees.api'

export type EmployeeTaskType = 'personal' | 'team' | 'client' | 'event'
export type EmployeeTaskStatus = 'pending' | 'for_review' | 'completed'
export type CompletionFlag = 'on_time' | 'late'

export interface TaskEmployeeRef extends EmployeeSummary {
  manager?: EmployeeSummary | string | null
}

export interface TaskTeamRef {
  _id: string
  name: string
  leader: TaskEmployeeRef
  members: TaskEmployeeRef[]
}

export interface TaskClientRef {
  _id: string
  name: string
  logoUrl?: string
  defaultTeam?: TaskTeamRef | string | null
}

export interface TaskEventRef {
  _id: string
  name: string
  description?: string
}

export interface ResourceRequired {
  label: string
  notes?: string
}

export interface ContactRequired {
  name: string
  role?: string
  phone?: string
  email?: string
}

export interface FollowUp {
  _id: string
  note?: string
  followUpAt: string
  isDone: boolean
  completedAt?: string
  completedBy?: TaskEmployeeRef
}

export interface ChainRef {
  _id: string
  title: string
  status: EmployeeTaskStatus
  completedAt?: string
  createdAt: string
}

export interface EmployeeTask {
  _id: string
  title: string
  description?: string
  type: EmployeeTaskType
  startAt: string
  endAt: string
  assignedEmployees: TaskEmployeeRef[]
  team?: TaskTeamRef
  extraMembers: TaskEmployeeRef[]
  client?: TaskClientRef
  event?: TaskEventRef
  resourcesRequired: ResourceRequired[]
  contactsRequired: ContactRequired[]
  followUps: FollowUp[]
  parentTask?: string | null
  reviewMandatory: boolean
  status: EmployeeTaskStatus
  markedForReviewAt?: string
  markedForReviewBy?: TaskEmployeeRef
  completionFlag?: CompletionFlag
  completedAt?: string
  completedBy?: TaskEmployeeRef
  createdBy?: TaskEmployeeRef
  continuesFrom?: ChainRef | null
  createdAt: string
  updatedAt: string
}

export interface FollowUpInput {
  note?: string
  followUpAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  type: EmployeeTaskType
  startAt: string
  endAt: string
  assignedEmployees?: string[]
  team?: string
  extraMembers?: string[]
  client?: string
  event?: string
  resourcesRequired?: ResourceRequired[]
  contactsRequired?: ContactRequired[]
  followUps?: FollowUpInput[]
  reviewMandatory?: boolean
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'type'>>

export interface CreateSubtaskInput {
  title: string
  description?: string
  startAt: string
  endAt: string
  assignedEmployees: string[]
  resourcesRequired?: ResourceRequired[]
  contactsRequired?: ContactRequired[]
  followUps?: FollowUpInput[]
  reviewMandatory?: boolean
}

export interface RejectTaskInput {
  title?: string
  description?: string
  startAt?: string
  endAt?: string
  note?: string
}

export interface CreateContinuationInput {
  title?: string
  description?: string
  startAt: string
  endAt: string
  assignedEmployees?: string[]
  extraMembers?: string[]
  reviewMandatory?: boolean
}

export async function listMyTasks(type?: EmployeeTaskType): Promise<{ tasks: EmployeeTask[] }> {
  const { data } = await apiClient.get('/employee-tasks/mine', { params: { type } })
  return data
}

export async function listUpcomingTasks(): Promise<{ tasks: EmployeeTask[] }> {
  const { data } = await apiClient.get('/employee-tasks/mine/upcoming')
  return data
}

export async function listReviewTasks(): Promise<{ isReviewer: boolean; tasks: EmployeeTask[] }> {
  const { data } = await apiClient.get('/employee-tasks/review')
  return data
}

export async function getTask(id: string): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.get(`/employee-tasks/${id}`)
  return data
}

export async function listSubtasks(id: string): Promise<{ subtasks: EmployeeTask[] }> {
  const { data } = await apiClient.get(`/employee-tasks/${id}/subtasks`)
  return data
}

export async function createTask(input: CreateTaskInput): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post('/employee-tasks', input)
  return data
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.patch(`/employee-tasks/${id}`, input)
  return data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/employee-tasks/${id}`)
}

export async function createSubtask(id: string, input: CreateSubtaskInput): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/subtasks`, input)
  return data
}

export async function addFollowUp(id: string, input: FollowUpInput): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/follow-ups`, input)
  return data
}

export async function toggleFollowUp(id: string, followUpId: string, isDone: boolean): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.patch(`/employee-tasks/${id}/follow-ups/${followUpId}`, { isDone })
  return data
}

export async function markForReview(id: string): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/mark-for-review`)
  return data
}

export async function markCompleted(id: string): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/complete`)
  return data
}

// Review-optional counterpart — same audience as markForReview, but lands
// straight on COMPLETED.
export async function markCompletedDirect(id: string): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/mark-completed-direct`)
  return data
}

export async function rejectTask(id: string, input: RejectTaskInput): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/reject`, input)
  return data
}

export async function createContinuation(
  id: string,
  input: CreateContinuationInput
): Promise<{ task: EmployeeTask }> {
  const { data } = await apiClient.post(`/employee-tasks/${id}/continue`, input)
  return data
}

export async function getChain(id: string): Promise<{ chain: EmployeeTask[] }> {
  const { data } = await apiClient.get(`/employee-tasks/${id}/chain`)
  return data
}

// Admin unified task view's "Filter by Employee"/"Filter by Team" —
// exactly one of the two must be provided (enforced server-side).
export async function listAdminFilteredTasks(filter: { employeeId?: string; teamId?: string }): Promise<{ tasks: EmployeeTask[] }> {
  const { data } = await apiClient.get('/employee-tasks/admin-filter', { params: filter })
  return data
}
