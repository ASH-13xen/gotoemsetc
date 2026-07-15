import { toast } from 'sonner'
import { Check, Loader2, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useDeleteResponsibility, useSetResponsibilityStatus } from '@/hooks/useEvents'
import type { EventResponsibility } from '@/api/events.api'

function fmt(iso?: string, withTime = false) {
  if (!iso) return null
  return withTime
    ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : new Date(iso).toLocaleDateString()
}

export function ResponsibilityRow({ responsibility, eventId }: { responsibility: EventResponsibility; eventId: string }) {
  const setStatus = useSetResponsibilityStatus(eventId)
  const remove = useDeleteResponsibility(eventId)
  const isDone = responsibility.status === 'done'
  const isOverdue = !isDone && responsibility.dueDate && new Date(responsibility.dueDate) < new Date()

  const onToggle = () => {
    setStatus.mutate(
      { id: responsibility._id, status: isDone ? 'pending' : 'done' },
      { onError: () => toast.error('Could not update this responsibility') }
    )
  }

  const onDelete = () => {
    if (!window.confirm('Remove this responsibility?')) return
    remove.mutate(responsibility._id, { onError: () => toast.error('Could not remove this responsibility') })
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-3">
      <button
        onClick={onToggle}
        disabled={setStatus.isPending}
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          isDone ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground/40'
        }`}
      >
        {isDone && <Check className="size-3.5 text-white" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${isDone ? 'text-muted-foreground line-through' : ''}`}>{responsibility.title}</span>
          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {responsibility.assignedTeam && (
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {responsibility.assignedTeam.name}
            </span>
          )}
          {responsibility.assignedEmployees.map((e) => (
            <span key={e._id} className="rounded-full bg-secondary/60 px-2 py-0.5">
              {e.firstName} {e.lastName}
            </span>
          ))}
          {responsibility.dueDate && <span>Due {fmt(responsibility.dueDate)}</span>}
          {responsibility.startTime && <span>From {fmt(responsibility.startTime, true)}</span>}
          {responsibility.endTime && <span>Until {fmt(responsibility.endTime, true)}</span>}
        </div>
      </div>

      <button onClick={onDelete} disabled={remove.isPending} className="text-muted-foreground hover:text-destructive">
        {remove.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  )
}
