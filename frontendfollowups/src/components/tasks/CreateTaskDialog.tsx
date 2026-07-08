import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useCreateTask } from '@/hooks/useTasks'
import { useTeams } from '@/hooks/useTeams'
import { PIPELINE_STAGES } from '@/api/tasks.api'
import type { TaskPriority, TaskStage } from '@/api/tasks.api'

const CUSTOM_STAGE = 'custom' as const
const NO_TEAM = '__none__'

export function CreateTaskDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stage, setStage] = useState<TaskStage>('plan_of_action')
  const [customLabel, setCustomLabel] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeTeam, setAssigneeTeam] = useState(NO_TEAM)
  const [assigneeEmployees, setAssigneeEmployees] = useState<string[]>([])

  const createTask = useCreateTask()
  const { data: teamsData } = useTeams()
  const teams = teamsData?.teams ?? []

  const reset = () => {
    setTitle('')
    setDescription('')
    setStage('plan_of_action')
    setCustomLabel('')
    setPriority('medium')
    setDueDate('')
    setAssigneeTeam(NO_TEAM)
    setAssigneeEmployees([])
  }

  const onSubmit = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (stage === CUSTOM_STAGE && !customLabel.trim()) {
      toast.error('Enter a label for this custom stage')
      return
    }
    createTask.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        client: clientId,
        stage,
        customLabel: stage === CUSTOM_STAGE ? customLabel.trim() : undefined,
        priority,
        dueDate: dueDate || undefined,
        assigneeTeam: assigneeTeam === NO_TEAM ? undefined : assigneeTeam,
        assigneeEmployees,
      },
      {
        onSuccess: () => {
          toast.success('Task created')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not create the task'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Label it with one of the 7 pipeline stages to auto-copy it into the Pipeline tab, or choose Custom.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Label</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as TaskStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_STAGE}>Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {stage === CUSTOM_STAGE && (
            <div className="grid gap-1.5">
              <Label htmlFor="task-custom-label">Custom label</Label>
              <Input
                id="task-custom-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Client Feedback"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="task-due">Due date (optional)</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Assign to team (optional)</Label>
            <Select value={assigneeTeam} onValueChange={setAssigneeTeam}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>No team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Assign to employees</Label>
            <EmployeePicker selectedIds={assigneeEmployees} onChange={setAssigneeEmployees} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={createTask.isPending}>
            {createTask.isPending && <Loader2 className="size-4 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
