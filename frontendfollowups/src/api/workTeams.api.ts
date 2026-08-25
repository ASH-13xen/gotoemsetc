import { apiClient } from './client'
import type { EmployeeSummary } from './employees.api'

// The 9 fixed tags a team member can hold, any number at once — replaces the
// old single `socialMediaManager` field and the old free-text `roleInTeam`.
// Mirrors backend/src/config/constants.js#TEAM_MEMBER_ROLE exactly.
export const TEAM_MEMBER_ROLES = [
  'videographer',
  'editor',
  'social_media_manager',
  'content_manager',
  'graphic_designer',
  'event_manager',
  'podcast_manager',
  'podcast_sales',
  'marketing_sales',
] as const
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]

export const TEAM_MEMBER_ROLE_LABEL: Record<TeamMemberRole, string> = {
  videographer: 'Videographer',
  editor: 'Editor',
  social_media_manager: 'Social Media Manager',
  content_manager: 'Content Manager',
  graphic_designer: 'Graphic Designer',
  event_manager: 'Event Manager',
  podcast_manager: 'Podcast Manager',
  podcast_sales: 'Podcast Sales',
  marketing_sales: 'Marketing Sales',
}

// A member's roles within this team, kept separate from Employee.designation
// (which is HR-owned, feeds salary slips, and is shared across every team the
// person is on).
export interface MemberRole {
  employee: EmployeeSummary
  roles: TeamMemberRole[]
}

export interface WorkTeam {
  _id: string
  name: string
  description?: string
  // Displayed everywhere as "Team Main" — this field keeps its name and its
  // existing local authority over the team's own day-to-day tasks. The
  // *global* Team Leader is a separate concept (the team_lead login role),
  // not tied to any one team.
  leader: EmployeeSummary
  members: EmployeeSummary[]
  memberRoles?: MemberRole[]
  isTemporary?: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkTeamInput {
  name: string
  description?: string
  leader: string
  members?: string[]
  memberRoles?: Array<{ employee: string; roles: TeamMemberRole[] }>
  isTemporary?: boolean
}

// Every employee id tagged with `role` on this team — a team may have more
// than one holder of the same role (e.g. two Social Media Managers), in
// which case work assigned to that role is shown as belonging to all of them
// collectively. Mirrors backend/src/utils/teamRoles.js#membersWithRole.
export function membersWithRole(team: Pick<WorkTeam, 'memberRoles'> | undefined, role: TeamMemberRole): EmployeeSummary[] {
  return (team?.memberRoles ?? []).filter((entry) => entry.roles.includes(role)).map((entry) => entry.employee)
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
