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
