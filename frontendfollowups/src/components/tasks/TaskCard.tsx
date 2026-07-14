import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Link2, Loader2, RotateCcw, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TaskStepRow } from './TaskStepRow'
import { TaskAssignmentEditor } from './TaskAssignmentEditor'
import { TaskChatPanel } from './TaskChatPanel'
import { useAddAttachment, useRemoveAttachment, useRolloverTask } from '@/hooks/useTasks'
import type { Task } from '@/api/tasks.api'

const STATUS_STYLES: Record<Task['status'], string> = {
  pending: 'bg-secondary text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700',
  done: 'bg-emerald-500/10 text-emerald-700',
  missed: 'bg-destructive/10 text-destructive',
  rolled_over: 'bg-muted text-muted-foreground/60',
}

export function TaskCard({ task, clientId }: { task: Task; clientId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [attachLabel, setAttachLabel] = useState('')
  const [attachUrl, setAttachUrl] = useState('')

  const addAttachment = useAddAttachment(task._id, clientId)
  const removeAttachment = useRemoveAttachment(task._id, clientId)
  const rollover = useRolloverTask(clientId)

  const doneSteps = task.steps.filter((s) => s.status === 'done').length

  const onAddAttachment = () => {
    if (!attachLabel.trim() || !attachUrl.trim()) return
    addAttachment.mutate(
      { label: attachLabel.trim(), url: attachUrl.trim() },
      {
        onSuccess: () => {
          setAttachLabel('')
          setAttachUrl('')
        },
        onError: () => toast.error('Could not add attachment — check the URL'),
      }
    )
  }

  const onRollover = () => {
    rollover.mutate(task._id, {
      onSuccess: () => toast.success('Rolled over into the current cycle'),
      onError: () => toast.error('Could not roll over this task'),
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setExpanded((v) => !v)}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{task.itemLabel}</span>
          <Badge className={STATUS_STYLES[task.status]}>{task.status.replace('_', ' ')}</Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {doneSteps}/{task.steps.length} steps
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {task.leadEmployee && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" />
              {task.leadEmployee.firstName}
            </span>
          )}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-4">
          {task.status === 'missed' && (
            <Button size="sm" variant="outline" onClick={onRollover} disabled={rollover.isPending} className="w-fit">
              {rollover.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Roll over into current cycle
            </Button>
          )}

          <div className="grid gap-2">
            {[...task.steps]
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <TaskStepRow key={step._id} task={task} step={step} clientId={clientId} />
              ))}
          </div>

          <TaskAssignmentEditor task={task} clientId={clientId} />

          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Attachments</p>
            {task.attachments.map((att, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-1.5 text-sm">
                <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Link2 className="size-3.5" />
                  {att.label}
                </a>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => removeAttachment.mutate(i)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Label" value={attachLabel} onChange={(e) => setAttachLabel(e.target.value)} className="h-8 w-32" />
              <Input placeholder="Link (Drive, etc.)" value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} className="h-8 flex-1" />
              <Button size="sm" onClick={onAddAttachment} disabled={addAttachment.isPending} className="h-8">
                Add
              </Button>
            </div>
          </div>

          <TaskChatPanel taskId={task._id} />
        </div>
      )}
    </div>
  )
}
