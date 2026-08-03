import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCreateTaskEvent, useUpdateTaskEvent } from '@/hooks/useTaskEvents'
import type { TaskEvent } from '@/api/taskEvents.api'

type FormValues = { name: string; description: string }

export function TaskEventFormDialog({ event, trigger }: { event?: TaskEvent; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const isEdit = Boolean(event)
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { name: event?.name ?? '', description: event?.description ?? '' },
  })
  const createEvent = useCreateTaskEvent()
  const updateEvent = useUpdateTaskEvent(event?._id ?? '')
  const isPending = createEvent.isPending || updateEvent.isPending

  const onSubmit = (values: FormValues) => {
    const mutation = isEdit ? updateEvent : createEvent
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(isEdit ? 'Event updated' : 'Event registered')
        setOpen(false)
        if (!isEdit) reset()
      },
      onError: () => toast.error('Could not save event'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'Register Event'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Event Name</Label>
            <Input {...register('name', { required: true })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isEdit ? 'Save Changes' : 'Register Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
