import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useRejectTask } from '@/hooks/useEmployeeTasks'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dateTime'
import type { EmployeeTask } from '@/api/employeeTasks.api'

type FormValues = { note: string; startAt: string; endAt: string }

// Sends a for_review task back to pending — optionally with new dates and
// a note explaining what needs to be redone. Fires a "reassigned" email to
// every current assignee with whatever new dates were set.
export function RejectTaskDialog({ task }: { task: EmployeeTask }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      note: '',
      startAt: toDateTimeLocalValue(task.startAt),
      endAt: toDateTimeLocalValue(task.endAt),
    },
  })
  const rejectTask = useRejectTask(task._id)

  const onSubmit = (values: FormValues) => {
    rejectTask.mutate(
      {
        note: values.note || undefined,
        startAt: values.startAt ? fromDateTimeLocalValue(values.startAt) : undefined,
        endAt: values.endAt ? fromDateTimeLocalValue(values.endAt) : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Sent back for redo')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not reject task'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Undo2 className="size-4" />
          Reject &amp; Redo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send back for redo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Textarea placeholder="What needs to be redone?" {...register('note')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>New Start</Label>
              <Input type="datetime-local" {...register('startAt')} />
            </div>
            <div className="grid gap-1.5">
              <Label>New Due</Label>
              <Input type="datetime-local" {...register('endAt')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={rejectTask.isPending}>
              Send Back
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
