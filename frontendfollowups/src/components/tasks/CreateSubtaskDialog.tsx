import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { DateTimePicker } from '@/components/shared/DateTimePicker'
import { useCreateSubtask } from '@/hooks/useEmployeeTasks'
import { fromDateTimeLocalValue } from '@/lib/dateTime'

type FormValues = {
  title: string
  description: string
  startAt: string
  endAt: string
  assignedEmployees: string[]
  reviewMandatory: boolean
}

export function CreateSubtaskDialog({
  parentTaskId,
  teamMemberIds,
}: {
  parentTaskId: string
  // Parent task's team roster (leader + members) — shown first, grouped
  // separately, in the assignee picker. Anyone else in the company can
  // still be picked; this just surfaces the team up top. Omit entirely
  // (e.g. a personal task's subtask, which has no team) to fall back to a
  // plain flat list.
  teamMemberIds?: string[]
}) {
  const [open, setOpen] = useState(false)
  const { control, register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { title: '', description: '', startAt: '', endAt: '', assignedEmployees: [], reviewMandatory: false },
  })
  const createSubtask = useCreateSubtask(parentTaskId)

  const onSubmit = (values: FormValues) => {
    createSubtask.mutate(
      {
        title: values.title,
        description: values.description || undefined,
        startAt: fromDateTimeLocalValue(values.startAt),
        endAt: fromDateTimeLocalValue(values.endAt),
        assignedEmployees: values.assignedEmployees,
        reviewMandatory: values.reviewMandatory,
      },
      {
        onSuccess: () => {
          toast.success('Subtask created')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not create subtask'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" />
          Add Subtask
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Subtask</DialogTitle>
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
              <Label>Due</Label>
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
          <div className="grid gap-1.5">
            <Label>Assignees</Label>
            <Controller
              control={control}
              name="assignedEmployees"
              rules={{ validate: (v) => v.length > 0 }}
              render={({ field }) => (
                <EmployeeMultiSelect
                  value={field.value}
                  onChange={field.onChange}
                  priorityIds={teamMemberIds}
                  priorityLabel="Team Members"
                />
              )}
            />
          </div>
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
          <DialogFooter>
            <Button type="submit" disabled={createSubtask.isPending}>
              Create Subtask
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
