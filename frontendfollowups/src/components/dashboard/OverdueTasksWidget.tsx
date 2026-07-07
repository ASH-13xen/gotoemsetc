import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OverdueTask } from '@/api/dashboard.api'

export function OverdueTasksWidget({ tasks }: { tasks: OverdueTask[] }) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-widest">Overdue Tasks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing overdue.</p>
        ) : (
          tasks.map((task) => (
            <button
              key={task._id}
              onClick={() => task.client && navigate(`/clients/${task.client._id}`)}
              className="flex flex-col items-start border-2 border-destructive/50 p-2 text-left hover:bg-destructive/10"
            >
              <span className="text-sm font-bold">{task.title}</span>
              <span className="text-xs text-muted-foreground">
                {task.client?.clientName ?? 'Internal'} · due {new Date(task.dueDate).toLocaleDateString()}
              </span>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}
