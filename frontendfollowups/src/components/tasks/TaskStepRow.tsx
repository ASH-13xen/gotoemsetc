import { useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, ChevronUp, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useDecideStepApproval, useUpdateStepAssignment, useUpdateStepStatus } from '@/hooks/useTasks'
import type { Task, TaskStep } from '@/api/tasks.api'

function toDateInputValue(iso?: string) {
  return iso ? iso.slice(0, 10) : ''
}

export function TaskStepRow({ task, step, clientId }: { task: Task; step: TaskStep; clientId: string }) {
  const [editing, setEditing] = useState(false)
  const [assignedIds, setAssignedIds] = useState(step.assignedEmployees.map((e) => e._id))
  const [dueDate, setDueDate] = useState(toDateInputValue(step.dueDate))
  const [requiresApproval, setRequiresApproval] = useState(step.requiresApproval)

  const updateStatus = useUpdateStepStatus(task._id, clientId)
  const updateAssignment = useUpdateStepAssignment(task._id, clientId)
  const decideApproval = useDecideStepApproval(task._id, clientId)

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
    updateAssignment.mutate(
      { stepId: step._id, input: { assignedEmployees: assignedIds, dueDate: dueDate || null, requiresApproval } },
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

  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggle}
          disabled={updateStatus.isPending || pendingApproval}
          className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            isDone ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground/40'
          } ${pendingApproval ? 'opacity-50' : ''}`}
        >
          {isDone && <Check className="size-3.5 text-white" />}
        </button>
        <span className={`flex-1 text-sm ${isDone ? 'text-muted-foreground line-through' : 'font-medium'}`}>
          {step.label}
        </span>
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
        <button onClick={() => setEditing((v) => !v)} className="text-muted-foreground hover:text-foreground">
          {editing ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {step.assignedEmployees.length > 0 && (
        <div className="ml-7 mt-1 flex flex-wrap gap-1">
          {step.assignedEmployees.map((e) => (
            <span key={e._id} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium">
              {e.firstName} {e.lastName}
            </span>
          ))}
        </div>
      )}

      {pendingApproval && (
        <div className="ml-7 mt-2 flex gap-2">
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

      {editing && (
        <div className="ml-7 mt-2 grid gap-2 rounded-lg bg-secondary/30 p-2.5">
          <EmployeePicker selectedIds={assignedIds} onChange={setAssignedIds} />
          <div className="flex items-center gap-3">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 w-40" />
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
              />
              Requires approval
            </label>
          </div>
          <Button size="sm" onClick={onSaveEdit} disabled={updateAssignment.isPending} className="w-fit">
            {updateAssignment.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
