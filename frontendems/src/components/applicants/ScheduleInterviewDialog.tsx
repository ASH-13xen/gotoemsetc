import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Loader2 } from 'lucide-react'

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
import { useScheduleInterview } from '@/hooks/useApplicants'

function defaultValue() {
  const inHourFromNow = new Date(Date.now() + 60 * 60 * 1000)
  inHourFromNow.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${inHourFromNow.getFullYear()}-${pad(inHourFromNow.getMonth() + 1)}-${pad(inHourFromNow.getDate())}T${pad(inHourFromNow.getHours())}:${pad(inHourFromNow.getMinutes())}`
}

export function ScheduleInterviewDialog({
  applicantId,
  isReschedule,
  trigger,
}: {
  applicantId: string
  isReschedule?: boolean
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(defaultValue())
  const [notes, setNotes] = useState('')
  const scheduleInterview = useScheduleInterview(applicantId)

  const onSubmit = () => {
    if (!scheduledAt) {
      toast.error('Please pick a date and time')
      return
    }
    scheduleInterview.mutate(
      { scheduledAt: new Date(scheduledAt).toISOString(), notes: notes || undefined },
      {
        onSuccess: () => {
          toast.success(isReschedule ? 'Interview rescheduled' : 'Interview scheduled — the applicant has been notified')
          setOpen(false)
        },
        onError: () => toast.error('Could not schedule the interview'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <CalendarClock className="size-4" />
            {isReschedule ? 'Reschedule' : 'Schedule meeting'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isReschedule ? 'Reschedule interview' : 'Schedule an interview'}</DialogTitle>
          <DialogDescription>
            The applicant gets a WhatsApp + email confirmation, and admins get an in-app notification.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="scheduledAt">Date &amp; time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (internal, optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Panel, meeting link, anything worth remembering…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={scheduleInterview.isPending}>
            {scheduleInterview.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
