import type { EmployeeTask, TaskEmployeeRef, TaskTeamRef } from '@/api/employeeTasks.api'
import type { StoredUser } from '@/lib/authStorage'
import { canManageSubtasks, canManageTasks, isAdminLike } from '@/lib/permissions'

// Frontend mirror of backend/src/utils/taskAccess.js — for optimistic
// show/hide of action buttons only. The server is the real enforcement
// point; every mutation is re-checked there regardless of what this says.
type EmployeeRefOrId = TaskEmployeeRef | string

function toId(value: EmployeeRefOrId | TaskTeamRef | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value._id
}

function idsInclude(list: EmployeeRefOrId[] | undefined, id: string): boolean {
  return (list ?? []).some((item) => toId(item) === id)
}

export function isAssignee(user: StoredUser | null, task: EmployeeTask): boolean {
  if (!user?.employeeLink) return false
  const employeeId = user.employeeLink

  if (task.parentTask || task.type === 'personal') {
    return idsInclude(task.assignedEmployees, employeeId)
  }
  return (
    idsInclude(task.team?.members, employeeId) ||
    idsInclude(task.extraMembers, employeeId) ||
    toId(task.team?.leader) === employeeId
  )
}

export function isTeamLeader(user: StoredUser | null, task: EmployeeTask): boolean {
  if (!user?.employeeLink || !task.team) return false
  return toId(task.team.leader) === user.employeeLink
}

export function isPersonalManager(user: StoredUser | null, task: EmployeeTask): boolean {
  if (!user?.employeeLink) return false
  const assignee = task.assignedEmployees?.[0]
  if (!assignee || typeof assignee === 'string') return false
  return toId(assignee.manager) === user.employeeLink
}

// Personal tasks and subtasks (any type): the assignee(s). Top-level
// team/client/event tasks: the leader only.
function isReviewInitiator(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.type === 'personal' || task.parentTask) return isAssignee(user, task)
  return isTeamLeader(user, task)
}

// Personal: admin/HR or the assignee's manager. Subtasks (any type):
// manage_subtasks holder or the team leader. Top-level team/client/event
// tasks: manage_tasks holder — the leader already made the call by marking
// it for review, so sign-off isn't self-servable by that same leader.
function hasCompletionAuthority(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.type === 'personal') return isAdminLike(user) || isPersonalManager(user, task)
  if (task.parentTask) return canManageSubtasks(user) || isTeamLeader(user, task)
  return canManageTasks(user)
}

// Only meaningful when the task actually requires review — see
// canMarkCompletedDirect for the review-optional counterpart.
export function canMarkForReview(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.status !== 'pending' || !task.reviewMandatory) return false
  return isReviewInitiator(user, task)
}

// Review-optional tasks skip the for_review checkpoint — the same person
// who'd otherwise mark it for review instead completes it directly.
export function canMarkCompletedDirect(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.status !== 'pending' || task.reviewMandatory) return false
  return isReviewInitiator(user, task)
}

export function canMarkCompleted(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.status !== 'for_review') return false
  return hasCompletionAuthority(user, task)
}

// Same audience as canMarkCompleted — whoever could approve a for_review
// task can instead send it back for a redo.
export function canRejectTask(user: StoredUser | null, task: EmployeeTask): boolean {
  if (task.status !== 'for_review') return false
  return hasCompletionAuthority(user, task)
}

// Whoever could have created this task can also edit/delete/continue it
// afterward — mirrors backend/src/middlewares/taskAccess.middleware.js#canManageOwnTask.
// ledTeamMemberIds is the flattened roster (leader + members) of every team
// the current user leads — only needed for a personal top-level task, since
// it carries no team of its own to check isTeamLeader against directly.
export function canManageTask(user: StoredUser | null, task: EmployeeTask, ledTeamMemberIds: string[] = []): boolean {
  if (task.parentTask) {
    return canManageSubtasks(user) || isTeamLeader(user, task)
  }
  if (task.type === 'personal') {
    const assigneeId = toId(task.assignedEmployees?.[0])
    return canManageTasks(user) || (Boolean(assigneeId) && ledTeamMemberIds.includes(assigneeId as string))
  }
  return canManageTasks(user) || isTeamLeader(user, task)
}

// Mirrors canCreateSubtask's authority — whoever could have created this
// task in the first place can also continue it once it's done. Subtask
// branch: personal subtasks were never continuable, by anyone (preserved
// as-is). Top-level: same authority as canManageTask.
export function canCreateContinuation(
  user: StoredUser | null,
  task: EmployeeTask,
  ledTeamMemberIds: string[] = []
): boolean {
  if (task.status !== 'completed') return false
  if (task.parentTask) {
    return task.type !== 'personal' && (canManageSubtasks(user) || isTeamLeader(user, task))
  }
  return canManageTask(user, task, ledTeamMemberIds)
}

export function canCreateSubtask(user: StoredUser | null, task: EmployeeTask): boolean {
  if (canManageSubtasks(user)) return true
  return task.type !== 'personal' && isTeamLeader(user, task)
}

export function canToggleFollowUp(user: StoredUser | null, task: EmployeeTask): boolean {
  if (canManageTasks(user) || canManageSubtasks(user)) return true
  if (isAssignee(user, task)) return true
  return task.type !== 'personal' && isTeamLeader(user, task)
}
