import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTaskChain } from '@/hooks/useEmployeeTasks'
import { TaskStatusBadge } from './TaskStatusBadge'

// e.g. "2d 4h", "45m" — the duration between a continuation task being
// assigned (createdAt) and it being finished (completedAt). Only shown
// once the task is actually done — see the user's TAT definition.
function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (!days && minutes) parts.push(`${minutes}m`)
  return parts.length ? parts.join(' ') : '< 1m'
}

// Newest first, current entry highlighted. Only renders once there's an
// actual chain (length > 1) — a task with no continuations shows nothing.
export function TaskChain({ taskId }: { taskId: string }) {
  const { data } = useTaskChain(taskId)
  const chain = data?.chain ?? []
  if (chain.length < 2) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold uppercase tracking-wide text-foreground">Continuation History</h2>
      <div className="space-y-2">
        {chain.map((entry) => {
          const isCurrent = entry._id === taskId
          const isContinuation = Boolean(entry.continuesFrom)
          const tat =
            isContinuation && entry.completedAt
              ? formatDuration(new Date(entry.completedAt).getTime() - new Date(entry.createdAt).getTime())
              : null
          return (
            <Link key={entry._id} to={`/tasks/${entry._id}`}>
              <Card className={cn('flex items-center justify-between gap-3 p-4', isCurrent && 'ring-2 ring-primary')}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{entry.title}</p>
                  {tat && <p className="text-xs text-muted-foreground">Turnaround time: {tat}</p>}
                </div>
                <TaskStatusBadge task={entry} />
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
