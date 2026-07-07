import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge'
import type { Task } from '@/api/tasks.api'

interface PipelineStageCardProps {
  label: string
  task?: Task
  onClick?: () => void
}

export function PipelineStageCard({ label, task, onClick }: PipelineStageCardProps) {
  const isBlocked = task?.status === 'blocked'

  return (
    <button
      type="button"
      onClick={task ? onClick : undefined}
      disabled={!task}
      className={cn(
        'flex flex-1 flex-col gap-2 border-2 border-foreground p-4 text-left transition-colors',
        task ? 'hover:bg-accent/50' : 'opacity-40',
        isBlocked && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
        {isBlocked && <Lock className="size-3.5" />}
        {label}
      </div>
      {task ? <TaskStatusBadge status={task.status} /> : <span className="text-xs text-muted-foreground">Not started</span>}
    </button>
  )
}
