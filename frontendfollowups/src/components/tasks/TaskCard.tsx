import { useState } from 'react'
import { toast } from 'sonner'
import { Link2, Loader2, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TaskStepRow } from './TaskStepRow'
import { TaskAssignmentEditor } from './TaskAssignmentEditor'
import { useAuth } from '@/hooks/useAuth'
import {
  useAddAttachment,
  useAddStep,
  useDeleteTask,
  useRemoveAttachment,
  useRolloverTask,
  useUpdateTaskDetails,
} from '@/hooks/useTasks'
import type { Task } from '@/api/tasks.api'

const STATUS_STYLES: Record<Task['status'], string> = {
  pending: 'bg-secondary text-muted-foreground',
  in_progress: 'bg-sky-500/10 text-sky-700',
  done: 'bg-emerald-500/10 text-emerald-700',
  missed: 'bg-destructive/10 text-destructive',
  rolled_over: 'bg-muted text-muted-foreground/60',
}

const DOT_STYLES: Record<Task['status'], string> = {
  pending: 'bg-muted-foreground/30',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  missed: 'bg-destructive',
  rolled_over: 'bg-muted-foreground/30',
}

// Compact clickable tile — the full editing surface lives in the dialog it
// opens. Keeps a section with many deliverables (e.g. 60+ Stories) scannable
// as a grid instead of a tall stack of expanded accordions.
export function TaskCard({ task, clientId }: { task: Task; clientId: string }) {
  const [open, setOpen] = useState(false)
  const doneSteps = task.steps.filter((s) => s.status === 'done').length
  const pct = task.steps.length ? (doneSteps / task.steps.length) * 100 : 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{task.itemLabel}</span>
          <span className={`size-2 shrink-0 rounded-full ${DOT_STYLES[task.status]}`} />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {doneSteps}/{task.steps.length} steps
          </span>
          {task.leadEmployee && (
            <span className="flex items-center gap-1 truncate">
              <Users className="size-3" />
              {task.leadEmployee.firstName}
            </span>
          )}
        </div>
      </button>

      {open && <TaskDetailDialog task={task} clientId={clientId} open={open} onOpenChange={setOpen} />}
    </>
  )
}

function TaskDetailDialog({
  task,
  clientId,
  open,
  onOpenChange,
}: {
  task: Task
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [attachLabel, setAttachLabel] = useState('')
  const [attachUrl, setAttachUrl] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? '')
  const [stepDraft, setStepDraft] = useState('')

  const addAttachment = useAddAttachment(task._id, clientId)
  const removeAttachment = useRemoveAttachment(task._id, clientId)
  const rollover = useRolloverTask(clientId)
  const updateDetails = useUpdateTaskDetails(task._id, clientId)
  const addStep = useAddStep(task._id, clientId)
  const deleteTask = useDeleteTask(clientId)

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

  const onSaveDescription = () => {
    updateDetails.mutate(
      { description: descriptionDraft.trim() || undefined },
      {
        onSuccess: () => setEditingDescription(false),
        onError: () => toast.error('Could not save description'),
      }
    )
  }

  const onAddStep = () => {
    const label = stepDraft.trim()
    if (!label) return
    addStep.mutate(
      { label },
      {
        onSuccess: () => setStepDraft(''),
        onError: () => toast.error('Could not add step'),
      }
    )
  }

  const onDeleteTask = () => {
    if (!window.confirm(`Delete "${task.itemLabel}"? This can't be undone.`)) return
    deleteTask.mutate(task._id, {
      onSuccess: () => {
        toast.success('Task deleted')
        onOpenChange(false)
      },
      onError: () => toast.error('Could not delete this task'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>{task.itemLabel}</DialogTitle>
            <Badge className={STATUS_STYLES[task.status]}>{task.status.replace('_', ' ')}</Badge>
          </div>
        </DialogHeader>

        <div className="grid gap-4">
          {task.status === 'missed' && (
            <Button size="sm" variant="outline" onClick={onRollover} disabled={rollover.isPending} className="w-fit">
              {rollover.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Roll over into current cycle
            </Button>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</p>
              {isAdmin && !editingDescription && (
                <button className="text-xs font-medium text-primary hover:underline" onClick={() => setEditingDescription(true)}>
                  {task.description ? 'Edit' : 'Add description'}
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="grid gap-2">
                <Textarea value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onSaveDescription} disabled={updateDetails.isPending}>
                    {updateDetails.isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90">{task.description || 'No description yet.'}</p>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Steps</p>
            {[...task.steps]
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <TaskStepRow key={step._id} task={task} step={step} clientId={clientId} />
              ))}
            {isAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="Add a step…"
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  className="h-8 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onAddStep()
                    }
                  }}
                />
                <Button size="sm" className="h-8" onClick={onAddStep} disabled={addStep.isPending}>
                  <Plus className="size-3.5" />
                  Add step
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Team &amp; assignment</p>
            <TaskAssignmentEditor task={task} clientId={clientId} />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Attachments &amp; links</p>
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
              <Input placeholder="Label (e.g. Post link)" value={attachLabel} onChange={(e) => setAttachLabel(e.target.value)} className="h-8 w-40" />
              <Input placeholder="URL" value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} className="h-8 flex-1" />
              <Button size="sm" onClick={onAddAttachment} disabled={addAttachment.isPending} className="h-8">
                Add
              </Button>
            </div>
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="w-fit text-destructive hover:bg-destructive/10"
              onClick={onDeleteTask}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete task
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
