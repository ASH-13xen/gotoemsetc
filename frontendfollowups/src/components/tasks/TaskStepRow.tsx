import { useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronUp, ClipboardList, Loader2, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useAuth } from '@/hooks/useAuth'
import { useDecideStepApproval, useRemoveStep, useUpdateStepAssignment, useUpdateStepStatus } from '@/hooks/useTasks'
import type { Task, TaskStep } from '@/api/tasks.api'

function toDateInputValue(iso?: string) {
  return iso ? iso.slice(0, 10) : ''
}

export function TaskStepRow({ task, step, clientId }: { task: Task; step: TaskStep; clientId: string }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(step.label)
  const [whatToDo, setWhatToDo] = useState(step.whatToDo ?? '')
  const [assignedIds, setAssignedIds] = useState(step.assignedEmployees.map((e) => e._id))
  const [dueDate, setDueDate] = useState(toDateInputValue(step.dueDate))
  const [requiresApproval, setRequiresApproval] = useState(step.requiresApproval)

  const updateStatus = useUpdateStepStatus(task._id, clientId)
  const updateAssignment = useUpdateStepAssignment(task._id, clientId)
  const decideApproval = useDecideStepApproval(task._id, clientId)
  const removeStep = useRemoveStep(task._id, clientId)

  const isDone = step.status === 'done'
  const isOverdue = step.dueDate && !isDone && new Date(step.dueDate) < new Date()
  const pendingApproval = step.requiresApproval && step.approvalStatus === 'pending'

  const onToggle = () => {
    updateStatus.mutate(
      { stepId: step._id, status: isDone ? 'todo' : 'done' },
      { onError: () => toast.error('Could not update step') }
    )
  }

  const onSaveEdit = () => {
    const input: Parameters<typeof updateAssignment.mutate>[0]['input'] = {
      assignedEmployees: assignedIds,
      dueDate: dueDate || null,
      requiresApproval,
    }
    if (isAdmin && label.trim() && label.trim() !== step.label) input.label = label.trim()
    if (whatToDo !== (step.whatToDo ?? '')) input.whatToDo = whatToDo.trim()

    updateAssignment.mutate(
      { stepId: step._id, input },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast.error('Could not save step details'),
      }
    )
  }

  const onApproval = (approved: boolean) => {
    decideApproval.mutate(
      { stepId: step._id, approved },
      { onError: () => toast.error('Could not record approval') }
    )
  }

  const onRemoveStep = () => {
    if (!window.confirm(`Remove step "${step.label}"?`)) return
    removeStep.mutate(step._id, { onError: () => toast.error('Could not remove step') })
  }

  return (
    <div className={`rounded-lg border p-3 transition-colors ${isDone ? 'border-border/50 bg-secondary/20' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          disabled={updateStatus.isPending || pendingApproval}
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isDone ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground/30 hover:border-primary'
          } ${pendingApproval ? 'opacity-50' : ''}`}
        >
          {isDone && <Check className="size-3.5 text-white" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-sm ${isDone ? 'text-muted-foreground line-through' : 'font-semibold'}`}>{step.label}</span>
            {pendingApproval && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Awaiting approval
              </span>
            )}
            {isOverdue && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                Overdue
              </span>
            )}
            {step.dueDate && (
              <span className="text-xs text-muted-foreground">{new Date(step.dueDate).toLocaleDateString()}</span>
            )}
          </div>

          {step.whatToDo && !editing && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <ClipboardList className="mt-0.5 size-3 shrink-0" />
              <span className="whitespace-pre-wrap">{step.whatToDo}</span>
            </p>
          )}

          {step.assignedEmployees.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {step.assignedEmployees.map((e) => (
                <span key={e._id} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {e.firstName} {e.lastName}
                </span>
              ))}
            </div>
          )}

          {pendingApproval && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onApproval(true)} disabled={decideApproval.isPending}>
                <ThumbsUp className="size-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onApproval(false)} disabled={decideApproval.isPending}>
                <ThumbsDown className="size-3.5" />
                Reject
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && (
            <button onClick={onRemoveStep} disabled={removeStep.isPending} className="p-1 text-muted-foreground hover:text-destructive">
              {removeStep.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>
          )}
          <button onClick={() => setEditing((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {editing ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid gap-3 rounded-lg bg-secondary/30 p-3 sm:grid-cols-2">
          <div className="grid gap-3">
            {isAdmin && (
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Step name</span>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 bg-card" />
              </div>
            )}
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">What to do</span>
              <Textarea
                value={whatToDo}
                onChange={(e) => setWhatToDo(e.target.value)}
                placeholder="Describe what's expected for this step…"
                rows={3}
                className="bg-card text-sm"
              />
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Assigned to</span>
              <EmployeePicker selectedIds={assignedIds} onChange={setAssignedIds} />
            </div>
            <div className="flex items-center gap-3">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-40 bg-card" />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
                Requires approval
              </label>
            </div>
          </div>
          <Button size="sm" onClick={onSaveEdit} disabled={updateAssignment.isPending} className="w-fit sm:col-span-2">
            {updateAssignment.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
