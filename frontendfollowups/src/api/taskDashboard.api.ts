import { apiClient } from './client'
import type { Task, TaskStep } from './tasks.api'

export interface DashboardEntry {
  task: Task
  step: TaskStep
}

export interface ClientCompletion {
  client: { _id: string; clientName: string; brandName: string; logoUrl?: string }
  total: number
  done: number
  rate: number
}

export interface DashboardResponse {
  overdue: DashboardEntry[]
  dueThisWeek: DashboardEntry[]
  completionByClient: ClientCompletion[]
}

export async function getDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get('/tasks/dashboard')
  return data
}

export interface WorkloadEntry {
  employee: { _id: string; firstName: string; lastName?: string; designation?: string }
  activeCount: number
}

export async function getWorkloadSummary(): Promise<{ summary: WorkloadEntry[] }> {
  const { data } = await apiClient.get('/tasks/workload')
  return data
}

export async function getWorkloadForEmployee(employeeId: string): Promise<{ tasks: Task[] }> {
  const { data } = await apiClient.get(`/tasks/workload/${employeeId}`)
  return data
}

export async function getContentCalendar(from: string, to: string): Promise<{ tasks: Task[] }> {
  const { data } = await apiClient.get('/tasks/calendar', { params: { from, to } })
  return data
}
