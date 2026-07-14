import { apiClient } from './client'

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'missed' | 'rolled_over'
export type StepStatus = 'todo' | 'in_progress' | 'done'
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected'

export interface EmployeeRef {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
}

export interface TaskStep {
  _id: string
  label: string
  order: number
  status: StepStatus
  assignedEmployees: EmployeeRef[]
  dueDate?: string
  requiresApproval: boolean
  approvalStatus: ApprovalStatus
  approvedBy?: EmployeeRef
  approvedAt?: string
  completedBy?: EmployeeRef
  completedAt?: string
}

export interface TaskAttachment {
  label: string
  url: string
  addedBy?: EmployeeRef
  addedAt: string
}

export interface Task {
  _id: string
  client: string | { _id: string; clientName: string; brandName: string; logoUrl?: string }
  cycle: string
  sectionName: string
  itemLabel: string
  itemIndex: number
  steps: TaskStep[]
  status: TaskStatus
  assignedTeam?: { _id: string; name: string }
  assignedEmployees: EmployeeRef[]
  leadEmployee?: EmployeeRef
  attachments: TaskAttachment[]
  rolledOverFrom?: string
  rolledOverTo?: string
  createdAt: string
}

export interface TaskCycle {
  _id: string
  client: string
  cycleNumber: number
  startDate: string
  endDate: string
  tasksGeneratedAt?: string
  closedAt?: string
}

export async function listTasksForClient(
  clientId: string,
  cycleId?: string
): Promise<{ cycles: TaskCycle[]; cycle: TaskCycle | null; tasks: Task[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/tasks`, { params: { cycleId } })
  return data
}

export async function syncClientCycle(clientId: string): Promise<{ cycle: TaskCycle | null; tasks: Task[] }> {
  const { data } = await apiClient.post(`/clients/${clientId}/tasks/sync`)
  return data
}

export async function getTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.get(`/tasks/${id}`)
  return data
}

export async function updateTaskAssignment(
  id: string,
  input: { assignedTeam?: string | null; assignedEmployees?: string[]; leadEmployee?: string | null }
): Promise<{ task: Task }> {
  const { data } = await apiClient.patch(`/tasks/${id}/assignment`, input)
  return data
}

export async function updateStepAssignment(
  taskId: string,
  stepId: string,
  input: { assignedEmployees?: string[]; dueDate?: string | null; requiresApproval?: boolean }
): Promise<{ task: Task }> {
  const { data } = await apiClient.patch(`/tasks/${taskId}/steps/${stepId}/assignment`, input)
  return data
}

export async function updateStepStatus(taskId: string, stepId: string, status: StepStatus): Promise<{ task: Task }> {
  const { data } = await apiClient.patch(`/tasks/${taskId}/steps/${stepId}/status`, { status })
  return data
}

export async function decideStepApproval(
  taskId: string,
  stepId: string,
  approved: boolean
): Promise<{ task: Task }> {
  const { data } = await apiClient.post(`/tasks/${taskId}/steps/${stepId}/approval`, { approved })
  return data
}

export async function addAttachment(taskId: string, label: string, url: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post(`/tasks/${taskId}/attachments`, { label, url })
  return data
}

export async function removeAttachment(taskId: string, attachmentIndex: number): Promise<{ task: Task }> {
  const { data } = await apiClient.delete(`/tasks/${taskId}/attachments/${attachmentIndex}`)
  return data
}

export async function rolloverTask(taskId: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post(`/tasks/${taskId}/rollover`)
  return data
}

export interface TaskMessage {
  _id: string
  task: string
  sender: EmployeeRef
  body: string
  createdAt: string
}

export async function listMessages(taskId: string): Promise<{ messages: TaskMessage[] }> {
  const { data } = await apiClient.get(`/tasks/${taskId}/messages`)
  return data
}

export async function postMessage(taskId: string, body: string): Promise<{ message: TaskMessage }> {
  const { data } = await apiClient.post(`/tasks/${taskId}/messages`, { body })
  return data
}
