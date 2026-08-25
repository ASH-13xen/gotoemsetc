import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useScheduleMeeting, useLogMeeting } from '@/hooks/useMeetings'
import type { Client, EmployeeRef } from '@/api/cms.api'
import type { MeetingType } from '@/api/meetings.api'

// Schedules a future meeting (emails + notifies participants) or logs a
// past one (recorded directly, no reminder/late-flag applies) — same form,
// the only difference is which mutation fires and whether the date can be
// in the past.
export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  client,
  mode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
  mode: 'schedule' | 'log'
}) {
  const schedule = useScheduleMeeting(client._id)
  const log = useLogMeeting(client._id)
  const mutation = mode === 'schedule' ? schedule : log

  const [date, setDate] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('online')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [participants, setParticipants] = useState<string[]>([])

  // Participants must be on the client's assigned team — same rule the
  // backend enforces.
  const roster: EmployeeRef[] = [
    ...(client.defaultTeam?.leader ? [client.defaultTeam.leader] : []),
    ...(client.defaultTeam?.members ?? []),
  ]

  const toggle = (id: string) => {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  const reset = () => {
    setDate('')
    setLocation('')
    setMeetingLink('')
    setParticipants([])
  }

  function submit() {
    if (!date || participants.length === 0) return
    mutation.mutate(
      {
        clientId: client._id,
        scheduledAt: new Date(date).toISOString(),
        meetingType,
        location: meetingType === 'offline' ? location : undefined,
        meetingLink: meetingType === 'online' ? meetingLink : undefined,
        participants,
      },
      { onSuccess: () => { reset(); onOpenChange(false) } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'schedule' ? 'Schedule a meeting' : 'Log a meeting'}</DialogTitle>
          <DialogDescription>
            {mode === 'schedule'
              ? 'Every participant is emailed and notified once this is saved.'
              : 'For a meeting that already happened — recorded directly, ready for its MOM right away.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Date &amp; time</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={meetingType} onValueChange={(v) => setMeetingType(v as MeetingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {meetingType === 'online' ? (
            <div className="space-y-1.5">
              <Label>Meeting link</Label>
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Participants — from {client.name}'s team</Label>
            {roster.length === 0 ? (
              <p className="text-xs text-muted-foreground">This client has no team assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roster.map((e) => {
                  const active = participants.includes(e._id)
                  return (
                    <button
                      key={e._id}
                      type="button"
                      onClick={() => toggle(e._id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {e.firstName} {e.lastName ?? ''}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!date || participants.length === 0 || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : mode === 'schedule' ? 'Schedule' : 'Log meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
