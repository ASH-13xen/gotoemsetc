import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateResponsibility } from '@/hooks/useEvents'
import { useTeams } from '@/hooks/useTeams'
import { EmployeePicker } from '@/components/pickers/EmployeePicker'

const NO_TEAM = '__none__'

export function ResponsibilityFormDialog({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
}) {
  const createResponsibility = useCreateResponsibility(eventId)
  const { data: teams } = useTeams()

  const [title, setTitle] = useState('')
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>([])
  const [assignedTeam, setAssignedTeam] = useState(NO_TEAM)
  const [dueDate, setDueDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const reset = () => {
    setTitle('')
    setAssignedEmployees([])
    setAssignedTeam(NO_TEAM)
    setDueDate('')
    setStartTime('')
    setEndTime('')
  }

  const onSubmit = () => {
    if (!title.trim()) {
      toast.error('Describe the responsibility')
      return
    }
    createResponsibility.mutate(
      {
        title: title.trim(),
        assignedEmployees,
        assignedTeam: assignedTeam === NO_TEAM ? undefined : assignedTeam,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Responsibility assigned')
          reset()
          onOpenChange(false)
        },
        onError: () => toast.error('Could not assign this responsibility'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a responsibility</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>What needs to be done</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Manage guest check-in" />
          </div>

          <div className="grid gap-1.5">
            <Label>Assign to team (optional)</Label>
            <Select value={assignedTeam} onValueChange={setAssignedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="No team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>No team</SelectItem>
                {(teams ?? []).map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Assign to individuals (optional)</Label>
            <EmployeePicker selectedIds={assignedEmployees} onChange={setAssignedEmployees} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Start time</Label>
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>End time</Label>
              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createResponsibility.isPending}>
            {createResponsibility.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
