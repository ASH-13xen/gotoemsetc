import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowRightCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { useCreateContinuation } from '@/hooks/useEmployeeTasks'
import { fromDateTimeLocalValue } from '@/lib/dateTime'
import type { EmployeeTask } from '@/api/employeeTasks.api'

type FormValues = {
  title: string
  description: string
  startAt: string
  endAt: string
  assignedEmployee: string
  assignedEmployees: string[]
  extraMembers: string[]
  reviewMandatory: boolean
}

// Only shown once a task is completed — a fresh, independently-tracked
// task linked back to this one (own turnaround time from here), reassigned
// to the same person or someone else. Type/team/client/event carry over
// from the original; only the work-defining fields are editable.
export function ContinueTaskDialog({ task }: { task: EmployeeTask }) {
  const [open, setOpen] = useState(false)
  const isPersonal = task.type === 'personal'
  const isSubtask = Boolean(task.parentTask)

  const { control, register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      startAt: '',
      endAt: '',
      assignedEmployee: isPersonal ? task.assignedEmployees[0]?._id ?? '' : '',
      assignedEmployees: isSubtask ? task.assignedEmployees.map((e) => e._id) : [],
      extraMembers: !isPersonal && !isSubtask ? task.extraMembers.map((e) => e._id) : [],
      reviewMandatory: task.reviewMandatory,
    },
  })
  const createContinuation = useCreateContinuation(task._id)

  const onSubmit = (values: FormValues) => {
    createContinuation.mutate(
      {
        title: values.title || undefined,
        description: values.description || undefined,
        startAt: fromDateTimeLocalValue(values.startAt),
        endAt: fromDateTimeLocalValue(values.endAt),
        assignedEmployees: isPersonal
          ? [values.assignedEmployee]
          : isSubtask
            ? values.assignedEmployees
            : undefined,
        extraMembers: !isPersonal && !isSubtask ? values.extraMembers : undefined,
        reviewMandatory: values.reviewMandatory,
      },
      {
        onSuccess: () => {
          toast.success('Continuation task created')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not create continuation'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <ArrowRightCircle className="size-4" />
          Continue / Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Continue this task</DialogTitle>
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
              <Label>Due</Label>
              <Input type="datetime-local" {...register('endAt', { required: true })} />
            </div>
          </div>

          {isPersonal && (
            <div className="grid gap-1.5">
              <Label>Assign To</Label>
              <Controller
                control={control}
                name="assignedEmployee"
                rules={{ required: true }}
                render={({ field }) => (
                  <EmployeeSingleSelect value={field.value} onChange={field.onChange} placeholder="SELECT EMPLOYEE" />
                )}
              />
            </div>
          )}

          {isSubtask && (
            <div className="grid gap-1.5">
              <Label>Assignees</Label>
              <Controller
                control={control}
                name="assignedEmployees"
                rules={{ validate: (v) => v.length > 0 }}
                render={({ field }) => <EmployeeMultiSelect value={field.value} onChange={field.onChange} />}
              />
            </div>
          )}

          {!isPersonal && !isSubtask && (
            <div className="grid gap-1.5">
              <Label>Extra Members (outside the team)</Label>
              <Controller
                control={control}
                name="extraMembers"
                render={({ field }) => <EmployeeMultiSelect value={field.value} onChange={field.onChange} />}
              />
              <p className="text-[10px] font-semibold text-muted-foreground">
                Team ({task.team?.name}) carries over from the original task.
              </p>
            </div>
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

          <DialogFooter>
            <Button type="submit" disabled={createContinuation.isPending}>
              Create Continuation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
