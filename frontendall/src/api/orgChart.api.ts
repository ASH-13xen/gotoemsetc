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
  // Positions only — the access this post gives whoever holds it (see the
  // backend's config/access.js). Never on the top (Admin) box.
  grantsRole: GrantableRole | null
}

export type GrantableRole =
  | 'ceo'
  | 'cto'
  | 'cfo'
  | 'hr'
  | 'operations_manager'
  | 'sales'
  | 'technical'
  | 'team_lead'
  | 'digital_admin'
  | 'finance'

// What each post's access means, in plain words — shown in the edit panel.
export const GRANT_INFO: Record<GrantableRole, { label: string; gives: string }> = {
  ceo: { label: 'CEO', gives: 'EMS for everyone (view + edit), HR Work, Operations, Performance Flags, Events, announcements, final approvals' },
  hr: { label: 'HR', gives: 'EMS for everyone (view + edit), HR Work, Events, announcements' },
  cfo: { label: 'CFO', gives: 'Finance (incl. approvals), announcements' },
  finance: { label: 'Finance', gives: 'Finance' },
  operations_manager: { label: 'Operations', gives: 'Operations tab, office keys, announcements' },
  cto: { label: 'CTO', gives: 'Announcements' },
  sales: { label: 'Sales', gives: 'Announcements' },
  team_lead: { label: 'Team Lead', gives: 'Announcements' },
  technical: { label: 'Technical', gives: 'Nothing extra yet' },
  digital_admin: { label: 'Digital Admin', gives: 'Nothing extra yet' },
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
  grantsRole?: GrantableRole | null
}

export async function createOrgNode(input: CreateOrgNodeInput) {
  const { data } = await apiClient.post('/org-chart/nodes', input)
  return data
}

export async function updateOrgNode(
  id: string,
  input: Partial<Pick<OrgNode, 'title' | 'description' | 'teamRole' | 'isTeamHead' | 'grantsRole'>> & { workTeam?: string | null }
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
