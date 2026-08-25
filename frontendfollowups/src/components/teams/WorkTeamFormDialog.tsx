import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { useCreateWorkTeam, useUpdateWorkTeam } from '@/hooks/useWorkTeams'
import { useEmployees } from '@/hooks/useEmployees'
import { TEAM_MEMBER_ROLES, TEAM_MEMBER_ROLE_LABEL, type TeamMemberRole, type WorkTeam } from '@/api/workTeams.api'

type FormValues = {
  name: string
  description: string
  leader: string
  members: string[]
  // Keyed by employee id — the API takes an array per member, but a map is
  // what the per-row toggles actually need as members come and go.
  roles: Record<string, TeamMemberRole[]>
}

export function WorkTeamFormDialog({ team, trigger }: { team?: WorkTeam; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(team)
  const { control, register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      name: team?.name ?? '',
      description: team?.description ?? '',
      leader: team?.leader?._id ?? '',
      // Team Main is already part of the team by definition — never
      // separately listed as a member too, even if older/bad data has them
      // in both.
      members: (team?.members ?? []).map((m) => m._id).filter((id) => id !== team?.leader?._id),
      roles: Object.fromEntries((team?.memberRoles ?? []).map((r) => [r.employee?._id, r.roles ?? []])),
    },
  })

  const leaderId = watch('leader')
  const memberIds = watch('members')
  const roles = watch('roles')
  const { data: employeeData } = useEmployees({ status: 'active', limit: 100 })

  // Team Main is on the roster too, so they get a role row and can hold tags.
  const rosterIds = [leaderId, ...memberIds].filter(Boolean)
  const employeeById = new Map((employeeData?.items ?? []).map((e) => [e._id, e]))

  const toggleRole = (employeeId: string, role: TeamMemberRole) => {
    const current = roles?.[employeeId] ?? []
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    setValue(`roles.${employeeId}`, next)
  }

  const createTeam = useCreateWorkTeam()
  const updateTeam = useUpdateWorkTeam(team?._id ?? '')
  const isPending = createTeam.isPending || updateTeam.isPending

  const onSubmit = (values: FormValues) => {
    const mutation = isEdit ? updateTeam : createTeam
    const members = values.members.filter((id) => id !== values.leader)
    const roster = [values.leader, ...members].filter(Boolean)

    mutation.mutate(
      {
        name: values.name,
        description: values.description,
        leader: values.leader,
        members,
        // Only roles for people actually on the roster, and only entries
        // with at least one tag — the server prunes these too, but sending
        // clean data keeps the form and the record in step.
        memberRoles: roster
          .filter((id) => (values.roles?.[id]?.length ?? 0) > 0)
          .map((id) => ({ employee: id, roles: values.roles[id] })),
      },
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
            <Label>Team Main</Label>
            <Controller
              control={control}
              name="leader"
              rules={{ required: true }}
              render={({ field }) => (
                <EmployeeSingleSelect value={field.value} onChange={field.onChange} placeholder="SELECT TEAM MAIN" />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Manages this team's own day-to-day tasks. Distinct from the company-wide Team Leader
              account, which reviews client work across every team.
            </p>
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

          {rosterIds.length > 0 && (
            <div className="grid gap-2">
              <Label>Roles in this team</Label>
              <p className="text-xs text-muted-foreground">
                Any member can hold any number of roles. A role with more than one holder (e.g. two
                Social Media Managers) gets its work assigned to all of them collectively in Client
                Management.
              </p>
              <div className="space-y-3">
                {rosterIds.map((id) => {
                  const employee = employeeById.get(id)
                  const activeRoles = roles?.[id] ?? []
                  return (
                    <div key={id} className="space-y-1.5 rounded-lg border border-border p-2.5">
                      <span className="text-sm font-semibold">
                        {employee ? `${employee.firstName} ${employee.lastName ?? ''}`.trim() : '—'}
                        {id === leaderId && <span className="font-normal text-muted-foreground"> (Team Main)</span>}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TEAM_MEMBER_ROLES.map((role) => {
                          const active = activeRoles.includes(role)
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(id, role)}
                              className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                active
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {TEAM_MEMBER_ROLE_LABEL[role]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
