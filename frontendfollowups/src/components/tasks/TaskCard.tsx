import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TASK_STATUS_STYLES, taskVisualStatus } from '@/lib/taskStatusColor'
import type { EmployeeTask } from '@/api/employeeTasks.api'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function employeeName(ref: EmployeeTask['assignedEmployees'][number]) {
  return `${ref.firstName} ${ref.lastName ?? ''}`.trim()
}

// Who/what the task belongs to — personal tasks and subtasks (any type)
// show the assignee(s); top-level team/client/event tasks already show the
// team name, extended with the leader so it's clear who's accountable.
function AssignmentLine({ task }: { task: EmployeeTask }) {
  if (task.type === 'personal' || task.parentTask) {
    const names = (task.assignedEmployees ?? []).map(employeeName).join(', ')
    return names ? <p className="text-xs text-muted-foreground">Assigned to: {names}</p> : null
  }
  if (task.team) {
    return (
      <p className="text-xs text-muted-foreground">
        Team: {task.team.name} · Led by: {employeeName(task.team.leader)}
      </p>
    )
  }
  return null
}

export function TaskCard({ task }: { task: EmployeeTask }) {
  const status = taskVisualStatus(task)
  const style = TASK_STATUS_STYLES[status]

  return (
    <Link to={`/tasks/${task._id}`}>
      {/* The status colour rides on a left accent bar rather than the whole
          card — these stack densely, and a wall of saturated cards is harder
          to scan than one with a single scannable edge. */}
      <Card className={`relative cursor-pointer space-y-3 overflow-hidden p-5 pl-6 ${style.tint}`}>
        <span className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} aria-hidden />
        <div className="flex items-start justify-between gap-2">
          <div>
            {task.client && (
              <p className="text-xs font-bold uppercase tracking-wider text-primary">{task.client.name}</p>
            )}
            {task.event && <p className="text-xs font-bold uppercase tracking-wider text-primary">{task.event.name}</p>}
            <p className="font-bold text-foreground">{task.title}</p>
            <AssignmentLine task={task} />
          </div>
          <TaskStatusBadge task={task} />
        </div>
        {task.description && <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground">Due {formatDateTime(task.endAt)}</p>
          {status === 'blocked' && task.blockedBy && (
            <p className="text-xs text-muted-foreground">Waiting on “{task.blockedBy.title}”</p>
          )}
        </div>
      </Card>
    </Link>
  )
}
