import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { useCreateWorkTeam, useUpdateWorkTeam } from '@/hooks/useWorkTeams'
import type { WorkTeam } from '@/api/workTeams.api'

type FormValues = { name: string; description: string; leader: string; members: string[] }

export function WorkTeamFormDialog({ team, trigger }: { team?: WorkTeam; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(team)
  const { control, register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      name: team?.name ?? '',
      description: team?.description ?? '',
      leader: team?.leader?._id ?? '',
      // The leader is already part of the team by definition — never
      // separately listed as a member too, even if older/bad data has them
      // in both.
      members: (team?.members ?? []).map((m) => m._id).filter((id) => id !== team?.leader?._id),
    },
  })
  const leaderId = watch('leader')
  const createTeam = useCreateWorkTeam()
  const updateTeam = useUpdateWorkTeam(team?._id ?? '')
  const isPending = createTeam.isPending || updateTeam.isPending

  const onSubmit = (values: FormValues) => {
    const mutation = isEdit ? updateTeam : createTeam
    mutation.mutate(
      { ...values, members: values.members.filter((id) => id !== values.leader) },
      {
        onSuccess: () => {
          toast.success(isEdit ? 'Team updated' : 'Team created')
          setOpen(false)
          if (!isEdit) reset()
        },
        onError: () => toast.error('Could not save team'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Team' : 'New Team'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Team Name</Label>
            <Input {...register('name', { required: true })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Input {...register('description')} />
          </div>
          <div className="grid gap-1.5">
            <Label>Leader</Label>
            <Controller
              control={control}
              name="leader"
              rules={{ required: true }}
              render={({ field }) => (
                <EmployeeSingleSelect value={field.value} onChange={field.onChange} placeholder="SELECT LEADER" />
              )}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Members</Label>
            <Controller
              control={control}
              name="members"
              render={({ field }) => (
                <EmployeeMultiSelect
                  value={field.value}
                  onChange={field.onChange}
                  excludeIds={leaderId ? [leaderId] : []}
                />
              )}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isEdit ? 'Save Changes' : 'Create Team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
