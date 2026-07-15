import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRescheduleEvent } from '@/hooks/useEvents'
import type { EventItem } from '@/api/events.api'

function toDateTimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function RescheduleDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: EventItem
}) {
  const reschedule = useRescheduleEvent(event._id)
  const [newStartAt, setNewStartAt] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNewStartAt(toDateTimeLocal(event.startAt))
  }, [open, event.startAt])

  const onSubmit = () => {
    if (!newStartAt) return
    reschedule.mutate(
      { newStartAt: new Date(newStartAt).toISOString(), note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Event rescheduled')
          setNote('')
          onOpenChange(false)
        },
        onError: () => toast.error('Could not reschedule this event'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Postpone / prepone event</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>New date & time</Label>
            <Input type="datetime-local" value={newStartAt} onChange={(e) => setNewStartAt(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Venue conflict" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={reschedule.isPending}>
            {reschedule.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
