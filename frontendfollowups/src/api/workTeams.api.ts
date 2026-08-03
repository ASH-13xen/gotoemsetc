import { apiClient } from './client'
import type { EmployeeSummary } from './employees.api'

export interface WorkTeam {
  _id: string
  name: string
  description?: string
  leader: EmployeeSummary
  members: EmployeeSummary[]
  createdAt: string
  updatedAt: string
}

export interface WorkTeamInput {
  name: string
  description?: string
  leader: string
  members?: string[]
}

export async function listWorkTeams(): Promise<{ teams: WorkTeam[] }> {
  const { data } = await apiClient.get('/work-teams')
  return data
}

export async function getWorkTeam(id: string): Promise<{ team: WorkTeam }> {
  const { data } = await apiClient.get(`/work-teams/${id}`)
  return data
}

export async function createWorkTeam(input: WorkTeamInput): Promise<{ team: WorkTeam }> {
  const { data } = await apiClient.post('/work-teams', input)
  return data
}

export async function updateWorkTeam(id: string, input: Partial<WorkTeamInput>): Promise<{ team: WorkTeam }> {
  const { data } = await apiClient.patch(`/work-teams/${id}`, input)
  return data
}

export async function deleteWorkTeam(id: string): Promise<void> {
  await apiClient.delete(`/work-teams/${id}`)
}
