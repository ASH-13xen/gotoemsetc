import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
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
import { useCreateTeam, useUpdateTeam } from '@/hooks/useTeams'
import { useEmployeeDirectory } from '@/hooks/useEmployees'
import type { Team } from '@/api/teams.api'

const NO_LEADER = '__none__'

export function TeamFormDialog({ team, trigger }: { team?: Team; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team?.name ?? '')
  const [description, setDescription] = useState(team?.description ?? '')
  const [members, setMembers] = useState<string[]>(team?.members.map((m) => m._id) ?? [])
  const [leader, setLeader] = useState(team?.leader?._id ?? NO_LEADER)

  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam(team?._id ?? '')
  const { data: directoryData } = useEmployeeDirectory()
  const employees = directoryData?.items ?? []

  useEffect(() => {
    if (!open) return
    setName(team?.name ?? '')
    setDescription(team?.description ?? '')
    setMembers(team?.members.map((m) => m._id) ?? [])
    setLeader(team?.leader?._id ?? NO_LEADER)
  }, [open, team])

  // The leader must be one of the picked members — drop it if they're removed.
  useEffect(() => {
    if (leader !== NO_LEADER && !members.includes(leader)) setLeader(NO_LEADER)
  }, [members, leader])

  const isBusy = createTeam.isPending || updateTeam.isPending

  const onSubmit = () => {
    if (!name.trim()) {
      toast.error('Team name is required')
      return
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      members,
      leader: leader === NO_LEADER ? undefined : leader,
    }
    if (team) {
      updateTeam.mutate(
        { ...payload, leader: leader === NO_LEADER ? null : leader },
        {
          onSuccess: () => {
            toast.success('Team updated')
            setOpen(false)
          },
          onError: () => toast.error('Could not update team'),
        }
      )
    } else {
      createTeam.mutate(payload, {
        onSuccess: () => {
          toast.success('Team created')
          setOpen(false)
        },
        onError: () => toast.error('Could not create team'),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? 'Edit team' : 'New team'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="team-description">Description (optional)</Label>
            <Textarea id="team-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Members</Label>
            <EmployeePicker selectedIds={members} onChange={setMembers} />
          </div>
          <div className="grid gap-1.5">
            <Label>Team leader</Label>
            <Select value={leader} onValueChange={setLeader}>
              <SelectTrigger>
                <SelectValue placeholder="Select a leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LEADER}>No leader</SelectItem>
                {members.map((memberId) => {
                  const member = employees.find((e) => e._id === memberId)
                  return (
                    <SelectItem key={memberId} value={memberId}>
                      {member ? `${member.firstName} ${member.lastName ?? ''}` : memberId}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">Pick members above to choose a leader among them.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={isBusy}>
            {isBusy && <Loader2 className="size-4 animate-spin" />}
            {team ? 'Save Changes' : 'Create Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
