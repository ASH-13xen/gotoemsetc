import type { EmployeeTask } from '@/api/employeeTasks.api'

export type TaskVisualStatus = 'overdue' | 'blocked' | 'pending' | 'for_review' | 'completed_late' | 'completed'

// One place that decides how a task reads at a glance, so the card, the badge
// and any future board view can never disagree.
//
// Ordering matters: a task past its deadline is overdue whatever else is true
// of it, and a blocked task (a reel's edit waiting on its shoot) is worth
// calling out before "pending", since nobody can act on it yet.
export function taskVisualStatus(task: EmployeeTask): TaskVisualStatus {
  if (task.status === 'completed') {
    return task.completionFlag === 'late' ? 'completed_late' : 'completed'
  }
  if (task.status === 'for_review') return 'for_review'

  if (new Date(task.endAt) < new Date()) return 'overdue'
  if (task.blockedBy && task.blockedBy.status !== 'completed') return 'blocked'
  return 'pending'
}

// Left accent bar + a faint tint. Deliberately not a full-colour card: these
// sit in a dense list, and flooding each one would make the whole board
// harder to scan rather than easier.
export const TASK_STATUS_STYLES: Record<TaskVisualStatus, { bar: string; tint: string; label: string }> = {
  overdue: { bar: 'bg-red-500', tint: 'bg-red-500/5', label: 'Overdue' },
  blocked: { bar: 'bg-slate-400', tint: 'bg-slate-400/5', label: 'Blocked' },
  pending: { bar: 'bg-orange-500', tint: '', label: 'Pending' },
  for_review: { bar: 'bg-purple-500', tint: 'bg-purple-500/5', label: 'For review' },
  completed_late: { bar: 'bg-amber-500', tint: 'bg-amber-500/5', label: 'Completed late' },
  completed: { bar: 'bg-green-600', tint: 'bg-green-600/5', label: 'Completed' },
}
