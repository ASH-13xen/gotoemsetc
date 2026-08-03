import { Badge } from '@/components/ui/badge'
import type { EmployeeTask } from '@/api/employeeTasks.api'

// Color verdict only exists once a task has actually been marked for
// review — before that it's just pending (or visibly overdue if the
// deadline has already passed with nobody having marked it yet).
export function TaskStatusBadge({ task }: { task: EmployeeTask }) {
  if (task.status === 'pending') {
    const overdue = new Date(task.endAt) < new Date()
    return <Badge variant={overdue ? 'warning' : 'outline'}>{overdue ? 'Overdue' : 'Pending'}</Badge>
  }

  const isOnTime = task.completionFlag === 'on_time'
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={isOnTime ? 'success' : 'destructive'}>{isOnTime ? 'On Time' : 'Late'}</Badge>
      <Badge variant="secondary">{task.status === 'for_review' ? 'For Review' : 'Completed'}</Badge>
    </div>
  )
}
