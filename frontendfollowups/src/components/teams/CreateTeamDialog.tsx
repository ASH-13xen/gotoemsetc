import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useCreateTeam } from '@/hooks/useTeams'

export function CreateTeamDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const createTeam = useCreateTeam()

  function reset() {
    setName('')
    setDescription('')
    setMemberIds([])
  }

  function onSubmit() {
    if (!name.trim()) {
      toast.error('Team name is required')
      return
    }
    createTeam.mutate(
      { name, description: description || undefined, members: memberIds },
      {
        onSuccess: () => {
          toast.success('Team created')
          reset()
          setOpen(false)
        },
        onError: () => toast.error('Could not create team'),
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
          New Team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">New Team</DialogTitle>
          <DialogDescription>Standing teams can be reused across tasks; ad-hoc groups are one-off.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Members</Label>
            <EmployeePicker selectedIds={memberIds} onChange={setMemberIds} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createTeam.isPending}>
            {createTeam.isPending && <Loader2 className="size-4 animate-spin" />}
            Save Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
