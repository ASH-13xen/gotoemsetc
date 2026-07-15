import { apiClient } from './client'

export interface TeamSummary {
  _id: string
  name: string
}

export async function listTeams(): Promise<TeamSummary[]> {
  const { data } = await apiClient.get('/teams')
  return data.teams ?? []
}
