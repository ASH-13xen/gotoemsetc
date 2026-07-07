import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useCreateTask } from '@/hooks/useTasks'
import { useTeams } from '@/hooks/useTeams'
import type { TaskPriority } from '@/api/tasks.api'

interface CreateTaskDialogProps {
  clientId?: string
}

export function CreateTaskDialog({ clientId }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [assigneeTeam, setAssigneeTeam] = useState<string>('')

  const createTask = useCreateTask()
  const { data: teamsData } = useTeams()

  function reset() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setAssigneeIds([])
    setAssigneeTeam('')
  }

  function onSubmit() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    createTask.mutate(
      {
        title,
        description: description || undefined,
        client: clientId,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigneeEmployees: assigneeIds,
        assigneeTeam: assigneeTeam || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Task created')
          reset()
          setOpen(false)
        },
        onError: () => toast.error('Could not create task'),
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">New Task</DialogTitle>
          <DialogDescription>
            {clientId ? 'Ad-hoc task for this client.' : 'Internal task, not tied to a client.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="grid gap-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Assign to Team</Label>
            <Select value={assigneeTeam || '__none__'} onValueChange={(v) => setAssigneeTeam(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No team</SelectItem>
                {(teamsData?.teams ?? []).map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Assign to Employees</Label>
            <EmployeePicker selectedIds={assigneeIds} onChange={setAssigneeIds} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createTask.isPending}>
            {createTask.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
