import { apiClient } from './client'

// Minimal read-only mirror of frontendfollowups' WorkTeam concept — same
// backend collection, /work-teams is open to any authenticated user. Used
// only to show "also leads: X" context in Add Credentials, since a team
// leader gets real Task Management authority (frontendfollowups) that
// doesn't show up as a checked permission here — see CredentialsDialog.tsx.
export interface WorkTeamSummary {
  _id: string
  name: string
  leader: { _id: string }
}

export async function listWorkTeams(): Promise<{ teams: WorkTeamSummary[] }> {
  const { data } = await apiClient.get('/work-teams')
  return data
}
