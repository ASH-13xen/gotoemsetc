import type { StoredUser } from '@/lib/authStorage'

// HR is admin-equivalent everywhere in Task Management.
export function isAdminLike(user: StoredUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'hr'
}

// Two independently-grantable permissions (via frontendems' Add
// Credentials, same underlying User.permissions the rest of the app uses)
// — manage_tasks covers top-level team/client/event tasks and the team/
// client/event registries; manage_subtasks covers subtask creation/review/
// completion. Holding one never implies the other; admin/HR implicitly
// hold both. Mirrors backend/src/utils/taskAccess.js's hasFullTaskAccess/
// hasSubtaskManageAccess.
export function canManageTasks(user: StoredUser | null | undefined): boolean {
  return isAdminLike(user) || Boolean(user?.permissions?.includes('manage_tasks'))
}

export function canManageSubtasks(user: StoredUser | null | undefined): boolean {
  return isAdminLike(user) || Boolean(user?.permissions?.includes('manage_subtasks'))
}

// The company-wide Team Leader account (the team_lead login role — not tied
// to any one team, distinct from a WorkTeam's own "Team Main"). Owns Task
// Management administration: creating/editing the team registry, and the
// "team leader" step of every client-work pipeline in Client Management.
export function isGlobalTeamLead(user: StoredUser | null | undefined): boolean {
  return user?.role === 'team_lead'
}

// Who may create/edit/delete WorkTeams. Deliberately its own name, not
// reused from canManageTasks — CEO/Team Leader get this without also
// picking up canManageTasks' broader top-level-task authority, which
// nobody asked for.
export function canManageTeamRegistry(user: StoredUser | null | undefined): boolean {
  return canManageTasks(user) || isGlobalTeamLead(user)
}

// Who sees the merged admin-style task board (all four types, filterable by
// client/team/employee/date) instead of the plain self-service one.
export function canViewUnifiedTasks(user: StoredUser | null | undefined): boolean {
  return canManageTasks(user) || user?.role === 'ceo' || isGlobalTeamLead(user)
}
