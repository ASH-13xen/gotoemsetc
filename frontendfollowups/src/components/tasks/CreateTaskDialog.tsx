import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { useCreateWorkTeam, useWorkTeams } from '@/hooks/useWorkTeams'
import { useTaskClients } from '@/hooks/useTaskClients'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import { useCreateTask } from '@/hooks/useEmployeeTasks'
import { useAuth } from '@/hooks/useAuth'
import { useLedTeams } from '@/hooks/useLedTeams'
import { canManageTasks } from '@/lib/permissions'
import { fromDateTimeLocalValue } from '@/lib/dateTime'
import type { EmployeeTaskType } from '@/api/employeeTasks.api'

type FormValues = {
  type: EmployeeTaskType
  title: string
  description: string
  startAt: string
  endAt: string
  assignedEmployee: string
  multiAssign: boolean
  assignedEmployees: string[]
  team: string
  useTemporaryTeam: boolean
  temporaryTeamName: string
  temporaryTeamLeader: string
  temporaryTeamMembers: string[]
  extraMembers: string[]
  client: string
  event: string
  reviewMandatory: boolean
  resourcesRequired: { label: string; notes: string }[]
  contactsRequired: { name: string; role: string; phone: string; email: string }[]
  followUps: { note: string; followUpAt: string }[]
}

const TYPE_LABEL: Record<EmployeeTaskType, string> = {
  personal: 'Personal Task',
  team: 'Team Task',
  client: 'Client Task',
  event: 'Event Task',
}

// No `type` prop anymore — the task list is a single page now, so the type
// is picked inside the dialog itself rather than implied by which tab
// you're on.
export function CreateTaskDialog({ defaultType = 'personal' }: { defaultType?: EmployeeTaskType }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const isAdmin = canManageTasks(user)
  const ledTeams = useLedTeams()
  // A team leader without manage_tasks can create any type of top-level
  // task, as long as it's tied to a team they lead (team/client/event all
  // carry a `team` field), or a Personal task for someone on it — mirrors
  // the backend's requireCanCreateTopLevelTask exactly. Everyone else who
  // can see this dialog at all (isAdmin) has no such restriction.
  const isLeaderOnly = !isAdmin && ledTeams.length > 0
  const allowedTypes: EmployeeTaskType[] = ['personal', 'team', 'client', 'event']
  const ledTeamIds = ledTeams.map((t) => t._id)
  const ledTeamMemberIds = ledTeams.flatMap((t) => [t.leader._id, ...t.members.map((m) => m._id)])

  const { control, register, handleSubmit, reset, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      type: allowedTypes.includes(defaultType) ? defaultType : allowedTypes[0],
      title: '',
      description: '',
      startAt: '',
      endAt: '',
      assignedEmployee: '',
      multiAssign: false,
      assignedEmployees: [],
      team: '',
      useTemporaryTeam: false,
      temporaryTeamName: '',
      temporaryTeamLeader: '',
      temporaryTeamMembers: [],
      extraMembers: [],
      client: '',
      event: '',
      reviewMandatory: false,
      resourcesRequired: [],
      contactsRequired: [],
      followUps: [],
    },
  })
  const resources = useFieldArray({ control, name: 'resourcesRequired' })
  const contacts = useFieldArray({ control, name: 'contactsRequired' })
  const followUps = useFieldArray({ control, name: 'followUps' })

  const type = watch('type')
  const selectedClientId = watch('client')
  const selectedTeamId = watch('team')
  const extraMembers = watch('extraMembers')
  const multiAssign = watch('multiAssign')
  const useTemporaryTeam = watch('useTemporaryTeam')
  const temporaryTeamLeader = watch('temporaryTeamLeader')
  const { data: teamsData } = useWorkTeams()
  const { data: clientsData } = useTaskClients()
  const { data: eventsData } = useTaskEvents()
  const createTask = useCreateTask()
  const createWorkTeam = useCreateWorkTeam()

  const selectedTeam = teamsData?.teams.find((t) => t._id === selectedTeamId)
  const selectedTeamRosterIds = selectedTeam ? [selectedTeam.leader._id, ...selectedTeam.members.map((m) => m._id)] : []

  // A client's default team auto-fills the Team field — still editable
  // afterward for a one-off override. Skipped for a leader-only user if
  // that default team isn't one they actually lead — otherwise the form
  // would silently carry a team id absent from their restricted Team
  // dropdown, and submitting would 403 with no visible cause.
  useEffect(() => {
    if (type !== 'client' || !selectedClientId) return
    const client = clientsData?.clients.find((c) => c._id === selectedClientId)
    if (!client?.defaultTeam) return
    if (isLeaderOnly && !ledTeamIds.includes(client.defaultTeam._id)) return
    setValue('team', client.defaultTeam._id)
  }, [type, selectedClientId, clientsData, isLeaderOnly, ledTeamIds, setValue])

  // A leader with exactly one team never needs to pick it, for any
  // team-scoped type (team/client/event) — same auto-fill-but-still-
  // editable idea as the client's default team above.
  useEffect(() => {
    if (type === 'personal' || !isLeaderOnly || ledTeamIds.length !== 1 || selectedTeamId) return
    setValue('team', ledTeamIds[0])
  }, [type, isLeaderOnly, ledTeamIds, selectedTeamId, setValue])

  // Extra Members means "outside the team" — once someone's on the
  // selected team's roster, drop them from here if they were already
  // picked (e.g. the team changed after they were added).
  useEffect(() => {
    if (selectedTeamRosterIds.length === 0) return
    const filtered = extraMembers.filter((id) => !selectedTeamRosterIds.includes(id))
    if (filtered.length !== extraMembers.length) setValue('extraMembers', filtered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId])

  const onSubmit = async (values: FormValues) => {
    if (values.type === 'personal' && values.multiAssign && values.assignedEmployees.length === 0) {
      toast.error('Select at least one employee')
      return
    }
    if (values.type === 'personal' && !values.multiAssign && !values.assignedEmployee) {
      toast.error('Select an employee')
      return
    }
    if (values.type !== 'personal' && values.useTemporaryTeam && !values.temporaryTeamLeader) {
      toast.error('Pick a Team Main for the temporary team')
      return
    }
    if (values.type !== 'personal' && !values.useTemporaryTeam && !values.team) {
      toast.error('Select a team')
      return
    }

    try {
      let teamId = values.team
      if (values.type !== 'personal' && values.useTemporaryTeam) {
        const { team } = await createWorkTeam.mutateAsync({
          name: values.temporaryTeamName.trim() || `Temporary — ${values.title || 'Task'}`,
          leader: values.temporaryTeamLeader,
          members: values.temporaryTeamMembers,
          isTemporary: true,
        })
        teamId = team._id
      }

      const basePayload = {
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        startAt: fromDateTimeLocalValue(values.startAt),
        endAt: fromDateTimeLocalValue(values.endAt),
        team: values.type !== 'personal' ? teamId : undefined,
        extraMembers: values.type !== 'personal' ? values.extraMembers : undefined,
        client: values.type === 'client' ? values.client : undefined,
        event: values.type === 'event' ? values.event : undefined,
        reviewMandatory: values.reviewMandatory,
        resourcesRequired: values.resourcesRequired.filter((r) => r.label.trim()),
        contactsRequired: values.contactsRequired.filter((c) => c.name.trim()),
        followUps: values.followUps
          .filter((f) => f.followUpAt)
          .map((f) => ({ note: f.note || undefined, followUpAt: fromDateTimeLocalValue(f.followUpAt) })),
      }

      if (values.type === 'personal' && values.multiAssign) {
        await Promise.all(
          values.assignedEmployees.map((employeeId) =>
            createTask.mutateAsync({ ...basePayload, assignedEmployees: [employeeId] })
          )
        )
        toast.success(`Created ${values.assignedEmployees.length} tasks`)
      } else {
        await createTask.mutateAsync({
          ...basePayload,
          assignedEmployees: values.type === 'personal' ? [values.assignedEmployee] : undefined,
        })
        toast.success('Task created')
      }

      setOpen(false)
      reset()
    } catch {
      toast.error('Could not create task')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t].toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {type === 'client' && (
            <div className="grid gap-1.5">
              <Label className="text-primary">Client Name</Label>
              <Controller
                control={control}
                name="client"
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="SELECT CLIENT" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientsData?.clients ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input {...register('title', { required: true })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Controller
                control={control}
                name="startAt"
                rules={{ required: true }}
                render={({ field }) => (
                  <DateTimePicker value={field.value} onChange={field.onChange} placeholder="SELECT START" />
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Due (End)</Label>
              <Controller
                control={control}
                name="endAt"
                rules={{ required: true }}
                render={({ field }) => (
                  <DateTimePicker value={field.value} onChange={field.onChange} placeholder="SELECT DUE" />
                )}
              />
            </div>
          </div>

          {type === 'personal' && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Assign To
                  {isLeaderOnly && (
                    <span className="ml-1.5 font-normal normal-case text-muted-foreground">
                      (your team{ledTeams.length > 1 ? 's' : ''} only)
                    </span>
                  )}
                </Label>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                  onClick={() => setValue('multiAssign', !multiAssign)}
                >
                  {multiAssign ? 'Assign to one person instead' : 'Assign to multiple employees?'}
                </button>
              </div>
              {multiAssign ? (
                <Controller
                  control={control}
                  name="assignedEmployees"
                  render={({ field }) => (
                    <EmployeeMultiSelect
                      value={field.value}
                      onChange={field.onChange}
                      includeIds={isLeaderOnly ? ledTeamMemberIds : undefined}
                    />
                  )}
                />
              ) : (
                <Controller
                  control={control}
                  name="assignedEmployee"
                  render={({ field }) => (
                    <EmployeeSingleSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="SELECT EMPLOYEE"
                      includeIds={isLeaderOnly ? ledTeamMemberIds : undefined}
                    />
                  )}
                />
              )}
            </div>
          )}

          {type !== 'personal' && (
            <>
              {type === 'event' && (
                <div className="grid gap-1.5">
                  <Label className="text-primary">Event</Label>
                  <Controller
                    control={control}
                    name="event"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="SELECT EVENT" />
                        </SelectTrigger>
                        <SelectContent>
                          {(eventsData?.events ?? []).map((ev) => (
                            <SelectItem key={ev._id} value={ev._id}>
                              {ev.name.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Team
                    {type === 'client' && !useTemporaryTeam && (
                      <span className="ml-1.5 font-normal normal-case text-muted-foreground">
                        (auto-filled from the client's default team — still editable)
                      </span>
                    )}
                  </Label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => {
                      const next = !useTemporaryTeam
                      setValue('useTemporaryTeam', next)
                      if (next && !watch('temporaryTeamName')) {
                        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        setValue('temporaryTeamName', `Temporary — ${watch('title') || 'Task'} (${today})`)
                      }
                    }}
                  >
                    {useTemporaryTeam ? 'Use an existing team instead' : 'Use a temporary team instead'}
                  </button>
                </div>
                {useTemporaryTeam ? (
                  <div className="grid gap-2 rounded-xl border border-dashed border-border p-3">
                    <Input placeholder="TEMPORARY TEAM NAME" {...register('temporaryTeamName')} />
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Team Main</Label>
                      <Controller
                        control={control}
                        name="temporaryTeamLeader"
                        render={({ field }) => (
                          <EmployeeSingleSelect
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="SELECT TEAM MAIN"
                            includeIds={isLeaderOnly ? ledTeamMemberIds : undefined}
                          />
                        )}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Members</Label>
                      <Controller
                        control={control}
                        name="temporaryTeamMembers"
                        render={({ field }) => (
                          <EmployeeMultiSelect
                            value={field.value}
                            onChange={field.onChange}
                            excludeIds={temporaryTeamLeader ? [temporaryTeamLeader] : []}
                            includeIds={isLeaderOnly ? ledTeamMemberIds : undefined}
                          />
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <Controller
                    control={control}
                    name="team"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="SELECT TEAM" />
                        </SelectTrigger>
                        <SelectContent>
                          {(teamsData?.teams ?? [])
                            .filter((t) => !isLeaderOnly || ledTeamIds.includes(t._id))
                            .map((t) => (
                              <SelectItem key={t._id} value={t._id}>
                                {t.name.toUpperCase()}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </div>

              <div className="grid gap-1.5">
                <Label>Extra Members (outside the team)</Label>
                <Controller
                  control={control}
                  name="extraMembers"
                  render={({ field }) => (
                    <EmployeeMultiSelect value={field.value} onChange={field.onChange} excludeIds={selectedTeamRosterIds} />
                  )}
                />
              </div>
            </>
          )}

          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-secondary/30 p-3">
            <Controller
              control={control}
              name="reviewMandatory"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
              )}
            />
            <span className="text-sm font-semibold text-foreground">Mark for Review mandatory</span>
          </label>
          <p className="-mt-2 text-[10px] font-semibold text-muted-foreground">
            Off by default — the assignee completes the task directly. When on, it goes through a review checkpoint
            first.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Resources Required</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => resources.append({ label: '', notes: '' })}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {resources.fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input placeholder="RESOURCE" {...register(`resourcesRequired.${index}.label` as const)} />
                <Input placeholder="NOTES" {...register(`resourcesRequired.${index}.notes` as const)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => resources.remove(index)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Contacts Required</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => contacts.append({ name: '', role: '', phone: '', email: '' })}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {contacts.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-4 gap-2">
                <Input placeholder="NAME" {...register(`contactsRequired.${index}.name` as const)} />
                <Input placeholder="ROLE" {...register(`contactsRequired.${index}.role` as const)} />
                <Input placeholder="PHONE" {...register(`contactsRequired.${index}.phone` as const)} />
                <div className="flex gap-1">
                  <Input placeholder="EMAIL" {...register(`contactsRequired.${index}.email` as const)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => contacts.remove(index)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Follow-ups</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => followUps.append({ note: '', followUpAt: '' })}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {followUps.fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <div className="w-48 shrink-0">
                  <Controller
                    control={control}
                    name={`followUps.${index}.followUpAt` as const}
                    render={({ field: dtField }) => (
                      <DateTimePicker value={dtField.value} onChange={dtField.onChange} placeholder="SELECT DATE & TIME" />
                    )}
                  />
                </div>
                <Input placeholder="NOTE" {...register(`followUps.${index}.note` as const)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => followUps.remove(index)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={formState.isSubmitting || createTask.isPending || createWorkTeam.isPending}>
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
