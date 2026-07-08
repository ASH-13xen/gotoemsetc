import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useMeetings, useUpdateMeetingMinutes } from '@/hooks/useMeetings'
import type { Meeting } from '@/api/meetings.api'

function MeetingCard({ clientId, meeting }: { clientId: string; meeting: Meeting }) {
  const [momDraft, setMomDraft] = useState('')
  const updateMinutes = useUpdateMeetingMinutes(clientId)

  const isPast = new Date(meeting.meetingDate).getTime() <= Date.now()
  const hasMinutes = Boolean(meeting.mom)

  const onSave = () => {
    if (!momDraft.trim()) {
      toast.error('Minutes cannot be empty')
      return
    }
    updateMinutes.mutate(
      { meetingId: meeting._id, mom: momDraft.trim() },
      {
        onSuccess: () => toast.success('Minutes saved'),
        onError: () => toast.error('Could not save minutes'),
      }
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">{meeting.topic}</CardTitle>
          {meeting.agenda && <p className="mt-1 text-sm text-muted-foreground">{meeting.agenda}</p>}
        </div>
        <Badge variant={isPast ? 'secondary' : 'outline'}>
          {isPast ? 'Completed' : 'Scheduled'}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p className="text-muted-foreground">{new Date(meeting.meetingDate).toLocaleString()}</p>

        {meeting.attendees.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.map((a) => (
              <Badge key={a._id} variant="outline">
                {a.firstName} {a.lastName}
              </Badge>
            ))}
          </div>
        )}

        {hasMinutes ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Minutes of meeting
            </p>
            <p className="whitespace-pre-wrap">{meeting.mom}</p>
          </div>
        ) : isPast ? (
          <div className="grid gap-2">
            <Textarea
              placeholder="Add minutes of meeting…"
              value={momDraft}
              onChange={(e) => setMomDraft(e.target.value)}
            />
            <Button size="sm" onClick={onSave} disabled={updateMinutes.isPending} className="w-fit">
              {updateMinutes.isPending && <Loader2 className="size-4 animate-spin" />}
              Save Minutes
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Minutes can be added once this meeting has taken place.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function MeetingList({ clientId }: { clientId: string }) {
  const { data, isLoading } = useMeetings(clientId)
  const meetings = data?.meetings ?? []

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading meetings…</p>
  if (meetings.length === 0) return <p className="text-sm text-muted-foreground">No meetings yet.</p>

  return (
    <div className="grid gap-4">
      {meetings.map((meeting) => (
        <MeetingCard key={meeting._id} clientId={clientId} meeting={meeting} />
      ))}
    </div>
  )
}
