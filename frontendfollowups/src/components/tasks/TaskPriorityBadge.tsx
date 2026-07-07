import { Badge } from '@/components/ui/badge'
import type { TaskPriority } from '@/api/tasks.api'

const PRIORITY_VARIANT: Record<TaskPriority, 'outline' | 'secondary' | 'warning' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'warning',
  urgent: 'destructive',
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{priority}</Badge>
}
