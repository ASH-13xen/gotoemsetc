import { useState } from 'react'
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { useTasks } from '@/hooks/useTasks'
import { PIPELINE_STAGES } from '@/api/tasks.api'
import type { Task } from '@/api/tasks.api'

function stageLabel(task: Task): string {
  if (task.stage === 'custom') return task.customLabel || 'Custom'
  return PIPELINE_STAGES.find((s) => s.value === task.stage)?.label ?? task.stage
}

export function TaskList({ clientId }: { clientId: string }) {
  const { data, isLoading } = useTasks({ client: clientId, limit: 200 })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const tasks = data?.items ?? []

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading tasks…</p>
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">No tasks yet.</p>

  return (
    <div className="grid gap-2">
      {tasks.map((task) => (
        <button
          key={task._id}
          onClick={() => setSelectedTask(task)}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/40"
        >
          <div>
            <p className="font-medium">{task.title}</p>
            <p className="text-xs text-muted-foreground">
              {stageLabel(task)}
              {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
              {task.assigneeTeam && ` · ${task.assigneeTeam.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TaskPriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} />
          </div>
        </button>
      ))}

      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}
