import { apiClient } from './client'

export type OrgNodeKind = 'position' | 'team' | 'team_role'

export type TeamRole =
  | 'content_manager'
  | 'social_media_manager'
  | 'videographer'
  | 'editor'
  | 'graphic_designer'
  | 'event_manager'
  | 'podcast_manager'
  | 'podcast_sales'
  | 'marketing_sales'

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  content_manager: 'Content Manager',
  social_media_manager: 'Social Media Manager',
  videographer: 'Videographer',
  editor: 'Video Editor',
  graphic_designer: 'Graphic Designer',
  event_manager: 'Event Manager',
  podcast_manager: 'Podcast Manager',
  podcast_sales: 'Podcast Sales',
  marketing_sales: 'Marketing Sales',
}

export interface OrgAssignee {
  _id: string
  firstName: string
  lastName?: string
  designation?: string
  employeeCode?: string
  status?: string
}

export interface OrgNode {
  _id: string
  title: string
  description?: string
  kind: OrgNodeKind
  parent: string | null
  order: number
  assignees: OrgAssignee[]
  workTeam: { _id: string; name: string; isDeleted?: boolean } | null
  teamRole: TeamRole | null
  isTeamHead: boolean
}

export interface LinkableWorkTeam {
  _id: string
  name: string
}

export async function getOrgChart(): Promise<{ nodes: OrgNode[]; linkableWorkTeams: LinkableWorkTeam[] }> {
  const { data } = await apiClient.get('/org-chart')
  return data
}

export interface CreateOrgNodeInput {
  title: string
  description?: string
  kind?: OrgNodeKind
  // Omitted only for the very first (top) box.
  parent?: string
  workTeam?: string | null
  teamRole?: TeamRole
  isTeamHead?: boolean
}

export async function createOrgNode(input: CreateOrgNodeInput) {
  const { data } = await apiClient.post('/org-chart/nodes', input)
  return data
}

export async function updateOrgNode(
  id: string,
  input: Partial<Pick<OrgNode, 'title' | 'description' | 'teamRole' | 'isTeamHead'>> & { workTeam?: string | null }
) {
  const { data } = await apiClient.patch(`/org-chart/nodes/${id}`, input)
  return data
}

export async function moveOrgNode(id: string, input: { parent?: string; order?: number }) {
  const { data } = await apiClient.post(`/org-chart/nodes/${id}/move`, input)
  return data
}

export async function setOrgNodeAssignees(id: string, employeeIds: string[]) {
  const { data } = await apiClient.put(`/org-chart/nodes/${id}/assignees`, { employeeIds })
  return data
}

export async function deleteOrgNode(id: string, mode: 'lift' | 'branch') {
  const { data } = await apiClient.delete(`/org-chart/nodes/${id}`, { params: { mode } })
  return data
}
