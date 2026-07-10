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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useScheduleInterview } from '@/hooks/useApplicants'
import type { MeetingType } from '@/api/applicants.api'

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
  const [meetingType, setMeetingType] = useState<MeetingType>('online')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [notes, setNotes] = useState('')
  const scheduleInterview = useScheduleInterview(applicantId)

  const onSubmit = () => {
    if (!scheduledAt) {
      toast.error('Please pick a date and time')
      return
    }
    scheduleInterview.mutate(
      {
        scheduledAt: new Date(scheduledAt).toISOString(),
        meetingType,
        location: meetingType === 'offline' ? location || undefined : undefined,
        meetingLink: meetingType === 'online' ? meetingLink || undefined : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(isReschedule ? 'Interview rescheduled' : 'Interview scheduled')
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
            Admins get an in-app notification. Once saved, use the Send Email/Send WhatsApp
            buttons on the applicant's page to notify them yourself.
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
            <Label>Meeting type</Label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as MeetingType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline (in-person)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {meetingType === 'online' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="meetingLink">Meeting link (optional)</Label>
              <Input
                id="meetingLink"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/…"
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Office address…"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (internal, optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Panel, interviewer, anything worth remembering…"
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
