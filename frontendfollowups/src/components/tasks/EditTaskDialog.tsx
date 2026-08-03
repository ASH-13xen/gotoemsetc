import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { useWorkTeams } from '@/hooks/useWorkTeams'
import { useTaskClients } from '@/hooks/useTaskClients'
import { useTaskEvents } from '@/hooks/useTaskEvents'
import { useUpdateTask } from '@/hooks/useEmployeeTasks'
import { useAuth } from '@/hooks/useAuth'
import { useLedTeams } from '@/hooks/useLedTeams'
import { canManageTasks } from '@/lib/permissions'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dateTime'
import type { EmployeeTask } from '@/api/employeeTasks.api'

type FormValues = {
  title: string
  description: string
  startAt: string
  endAt: string
  assignedEmployee: string
  team: string
  extraMembers: string[]
  client: string
  event: string
  reviewMandatory: boolean
  resourcesRequired: { label: string; notes: string }[]
  contactsRequired: { name: string; role: string; phone: string; email: string }[]
}

// type is immutable once created (see employeeTask.validator.js) — every
// other field admin set at creation can still be changed here.
export function EditTaskDialog({ task }: { task: EmployeeTask }) {
  const [open, setOpen] = useState(false)
  const isPersonalOrSubtask = task.type === 'personal' || Boolean(task.parentTask)
  const { user } = useAuth()
  const ledTeams = useLedTeams()
  // A leader editing their own team's task shouldn't be offered a team/
  // assignee outside their own scope — the backend rejects it anyway (see
  // requireCanUpdateTask's reassignment guard), this just keeps the picker
  // from showing choices that would 403.
  const isLeaderOnly = !canManageTasks(user) && ledTeams.length > 0
  const ledTeamIds = ledTeams.map((t) => t._id)
  const ledTeamMemberIds = ledTeams.flatMap((t) => [t.leader._id, ...t.members.map((m) => m._id)])

  const { control, register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      startAt: toDateTimeLocalValue(task.startAt),
      endAt: toDateTimeLocalValue(task.endAt),
      assignedEmployee: isPersonalOrSubtask ? task.assignedEmployees[0]?._id ?? '' : '',
      team: task.team?._id ?? '',
      extraMembers: task.extraMembers.map((e) => e._id),
      client: task.client?._id ?? '',
      event: task.event?._id ?? '',
      reviewMandatory: task.reviewMandatory,
      resourcesRequired: task.resourcesRequired.map((r) => ({ label: r.label, notes: r.notes ?? '' })),
      contactsRequired: task.contactsRequired.map((c) => ({
        name: c.name,
        role: c.role ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
      })),
    },
  })
  const resources = useFieldArray({ control, name: 'resourcesRequired' })
  const contacts = useFieldArray({ control, name: 'contactsRequired' })

  const { data: teamsData } = useWorkTeams()
  const { data: clientsData } = useTaskClients()
  const { data: eventsData } = useTaskEvents()
  const updateTask = useUpdateTask(task._id)

  const selectedTeamId = watch('team')
  const selectedTeam = teamsData?.teams.find((t) => t._id === selectedTeamId)
  const selectedTeamRosterIds = selectedTeam ? [selectedTeam.leader._id, ...selectedTeam.members.map((m) => m._id)] : []
  const extraMembers = watch('extraMembers')

  // Extra Members means "outside the team" — drop anyone who's on the
  // roster if the team was just switched to one that now includes them.
  useEffect(() => {
    if (selectedTeamRosterIds.length === 0) return
    const filtered = extraMembers.filter((id) => !selectedTeamRosterIds.includes(id))
    if (filtered.length !== extraMembers.length) setValue('extraMembers', filtered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId])

  const onSubmit = (values: FormValues) => {
    updateTask.mutate(
      {
        title: values.title,
        description: values.description || undefined,
        startAt: fromDateTimeLocalValue(values.startAt),
        endAt: fromDateTimeLocalValue(values.endAt),
        assignedEmployees: isPersonalOrSubtask ? [values.assignedEmployee] : undefined,
        team: task.type !== 'personal' ? values.team : undefined,
        extraMembers: task.type !== 'personal' && !task.parentTask ? values.extraMembers : undefined,
        client: task.type === 'client' ? values.client : undefined,
        event: task.type === 'event' ? values.event : undefined,
        reviewMandatory: values.reviewMandatory,
        resourcesRequired: values.resourcesRequired.filter((r) => r.label.trim()),
        contactsRequired: values.contactsRequired.filter((c) => c.name.trim()),
      },
      {
        onSuccess: () => {
          toast.success('Task updated')
          setOpen(false)
        },
        onError: () => toast.error('Could not update task'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Input type="datetime-local" {...register('startAt', { required: true })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Due (End)</Label>
              <Input type="datetime-local" {...register('endAt', { required: true })} />
            </div>
          </div>

          {isPersonalOrSubtask && (
            <div className="grid gap-1.5">
              <Label>Assign To</Label>
              <Controller
                control={control}
                name="assignedEmployee"
                rules={{ required: true }}
                render={({ field }) => (
                  <EmployeeSingleSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="SELECT EMPLOYEE"
                    includeIds={isLeaderOnly && task.type === 'personal' ? ledTeamMemberIds : undefined}
                  />
                )}
              />
            </div>
          )}

          {task.type !== 'personal' && !task.parentTask && (
            <>
              {task.type === 'client' && (
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
              {task.type === 'event' && (
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
                <Label>Team</Label>
                <Controller
                  control={control}
                  name="team"
                  rules={{ required: true }}
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

          <DialogFooter>
            <Button type="submit" disabled={updateTask.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
