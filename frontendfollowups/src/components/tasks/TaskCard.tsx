import { Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge'
import type { Task } from '@/api/tasks.api'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const isBlocked = task.status === 'blocked'

  return (
    <Card
      onClick={onClick}
      className={cn('cursor-pointer gap-3 py-4 transition-colors hover:bg-accent/50', isBlocked && 'opacity-60')}
    >
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isBlocked && <Lock className="size-3.5 shrink-0" />}
          {task.title}
        </CardTitle>
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {task.client ? task.client.clientName : 'Internal'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 px-4">
        <TaskPriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</span>
        )}
        {task.assigneeEmployees.map((a) => (
          <span key={a._id} className="text-xs text-muted-foreground">
            {a.firstName}
          </span>
        ))}
        {task.assigneeTeam && <span className="text-xs text-muted-foreground">Team: {task.assigneeTeam.name}</span>}
      </CardContent>
    </Card>
  )
}
