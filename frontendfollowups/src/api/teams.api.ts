import { apiClient } from './client'
import type { MeetingAttendee } from './meetings.api'

export interface Team {
  _id: string
  name: string
  description?: string
  members: MeetingAttendee[]
  isStanding: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTeamInput {
  name: string
  description?: string
  members?: string[]
  isStanding?: boolean
}

export interface UpdateTeamInput {
  name?: string
  description?: string
  members?: string[]
  isStanding?: boolean
}

export async function listTeams(): Promise<{ teams: Team[] }> {
  const { data } = await apiClient.get('/teams')
  return data
}

export async function getTeam(id: string): Promise<{ team: Team }> {
  const { data } = await apiClient.get(`/teams/${id}`)
  return data
}

export async function createTeam(input: CreateTeamInput): Promise<{ team: Team }> {
  const { data } = await apiClient.post('/teams', input)
  return data
}

export async function updateTeam(id: string, input: UpdateTeamInput): Promise<{ team: Team }> {
  const { data } = await apiClient.patch(`/teams/${id}`, input)
  return data
}

export async function deleteTeam(id: string): Promise<void> {
  await apiClient.delete(`/teams/${id}`)
}
