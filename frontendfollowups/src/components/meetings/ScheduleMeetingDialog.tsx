import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { EmployeePicker } from '@/components/teams/EmployeePicker'
import { useCreateMeeting } from '@/hooks/useMeetings'

function defaultDateTimeLocal(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function ScheduleMeetingDialog({ clientId, trigger }: { clientId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [agenda, setAgenda] = useState('')
  const [meetingDate, setMeetingDate] = useState(defaultDateTimeLocal())
  const [attendees, setAttendees] = useState<string[]>([])

  const createMeeting = useCreateMeeting(clientId)

  const reset = () => {
    setTopic('')
    setAgenda('')
    setMeetingDate(defaultDateTimeLocal())
    setAttendees([])
  }

  const onSubmit = () => {
    if (!topic.trim() || !meetingDate) {
      toast.error('Topic and date/time are required')
      return
    }
    createMeeting.mutate(
      { topic: topic.trim(), agenda: agenda.trim() || undefined, meetingDate, attendees },
      {
        onSuccess: () => {
          toast.success('Meeting scheduled')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not schedule the meeting'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a meeting</DialogTitle>
          <DialogDescription>Minutes of meeting can be added once the scheduled time has passed.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="meeting-topic">Topic</Label>
            <Input id="meeting-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting-agenda">Agenda / why (optional)</Label>
            <Textarea id="meeting-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="meeting-date">Date & time</Label>
            <Input
              id="meeting-date"
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Attendees</Label>
            <EmployeePicker selectedIds={attendees} onChange={setAttendees} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={createMeeting.isPending}>
            {createMeeting.isPending && <Loader2 className="size-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
