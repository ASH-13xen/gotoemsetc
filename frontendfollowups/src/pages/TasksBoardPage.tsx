import { useState } from 'react'
import { NavBar } from '@/components/layout/NavBar'
import { KanbanColumn } from '@/components/tasks/KanbanColumn'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { useTasks } from '@/hooks/useTasks'
import type { Task, TaskStatus } from '@/api/tasks.api'

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'done', label: 'Done' },
]

// Client-having tasks sort alphabetically by client name; tasks with no
// client (internal/ad-hoc) are optional, per the pipeline design, and sort
// after all client tasks.
function byClientName(a: Task, b: Task) {
  if (!a.client && !b.client) return 0
  if (!a.client) return 1
  if (!b.client) return -1
  return a.client.clientName.localeCompare(b.client.clientName)
}

export default function TasksBoardPage() {
  const { data, isLoading } = useTasks({ limit: 200 })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const tasks = [...(data?.items ?? [])].sort(byClientName)

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">All Tasks</h1>
          <CreateTaskDialog />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                title={col.label}
                tasks={tasks.filter((t) => t.status === col.status)}
                onTaskClick={setSelectedTask}
              />
            ))}
          </div>
        )}

        <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
      </main>
    </div>
  )
}
