import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task } from '@/api/tasks.api'

interface KanbanColumnProps {
  title: string
  tasks: Task[]
  onTaskClick?: (task: Task) => void
}

export function KanbanColumn({ title, tasks, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="flex min-w-64 flex-1 flex-col gap-3 border-2 border-foreground p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black tracking-widest uppercase">{title}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing here.</p>
        ) : (
          tasks.map((task) => <TaskCard key={task._id} task={task} onClick={() => onTaskClick?.(task)} />)
        )}
      </div>
    </div>
  )
}
