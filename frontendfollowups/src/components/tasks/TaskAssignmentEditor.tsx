import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useTeams } from '@/hooks/useTeams'
import { useEmployeeDirectory } from '@/hooks/useEmployees'
import { useUpdateTaskAssignment } from '@/hooks/useTasks'
import type { Task } from '@/api/tasks.api'

const NONE = '__none__'

export function TaskAssignmentEditor({ task, clientId }: { task: Task; clientId: string }) {
  const { data: teamsData } = useTeams()
  const teams = teamsData?.teams ?? []
  const { data: directoryData } = useEmployeeDirectory()
  const employees = directoryData?.items ?? []
  const updateAssignment = useUpdateTaskAssignment(task._id, clientId)

  const [assignedIds, setAssignedIds] = useState(task.assignedEmployees.map((e) => e._id))
  const [leadId, setLeadId] = useState(task.leadEmployee?._id ?? NONE)
  const [teamId, setTeamId] = useState(task.assignedTeam?._id ?? NONE)

  const onSave = () => {
    updateAssignment.mutate(
      {
        assignedTeam: teamId === NONE ? null : teamId,
        assignedEmployees: assignedIds,
        leadEmployee: leadId === NONE ? null : leadId,
      },
      {
        onSuccess: () => toast.success('Assignment updated'),
        onError: () => toast.error('Could not update assignment'),
      }
    )
  }

  return (
    <div className="grid gap-3 rounded-lg bg-secondary/30 p-3">
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Team (optional)</Label>
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="No team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t._id} value={t._id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Employees</Label>
        <EmployeePicker selectedIds={assignedIds} onChange={setAssignedIds} />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Leader (answerable)</Label>
        <Select value={leadId} onValueChange={setLeadId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="No leader" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {assignedIds.map((id) => {
              const emp = employees.find((e) => e._id === id) ?? task.assignedEmployees.find((e) => e._id === id)
              return (
                <SelectItem key={id} value={id}>
                  {emp?.firstName} {emp?.lastName}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={onSave} disabled={updateAssignment.isPending} className="w-fit">
        {updateAssignment.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Save assignment
      </Button>
    </div>
  )
}
