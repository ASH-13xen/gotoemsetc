import { Badge } from '@/components/ui/badge'
import type { TaskStatus } from '@/api/tasks.api'

const STATUS_VARIANT: Record<TaskStatus, 'outline' | 'secondary' | 'warning' | 'success'> = {
  todo: 'outline',
  in_progress: 'secondary',
  blocked: 'warning',
  done: 'success',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
