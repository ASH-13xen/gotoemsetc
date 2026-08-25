import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCancelMeeting, useRescheduleMeeting } from '@/hooks/useMeetings'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { MomForm } from './MomForm'
import { AddTaskFromMomDialog } from './AddTaskFromMomDialog'
import type { Client } from '@/api/cms.api'
import type { Meeting } from '@/api/meetings.api'

const DAY_MS = 24 * 60 * 60 * 1000

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MeetingCard({ client, meeting }: { client: Client; meeting: Meeting }) {
  const [open, setOpen] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [addTaskOpen, setAddTaskOpen] = useState(false)

  const { canManageCalendar } = useCmsAccess()
  // Meetings/MOM permission mirrors the CMS write bar closely enough for the
  // UI's purposes (server re-checks the real per-team rule regardless).
  const canManage = canManageCalendar

  const reschedule = useRescheduleMeeting(client._id, meeting._id)
  const cancel = useCancelMeeting(client._id, meeting._id)

  const isLate = !meeting.mom && meeting.status !== 'cancelled' && Date.now() - new Date(meeting.scheduledAt).getTime() > DAY_MS
  const isPast = new Date(meeting.scheduledAt).getTime() < Date.now()

  return (
    <div className="rounded-xl border border-border/40">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{fmt(meeting.scheduledAt)}</span>
        {meeting.isLogged && <Badge variant="outline" className="font-normal">Logged</Badge>}
        {meeting.status === 'cancelled' && <Badge variant="destructive" className="font-normal">Cancelled</Badge>}
        {isLate && <Badge className="bg-amber-500 font-normal text-white">MOM late</Badge>}
        {!meeting.mom && meeting.status !== 'cancelled' && !isLate && (
          <Badge variant="outline" className="font-normal">{isPast ? 'Awaiting MOM' : 'Upcoming'}</Badge>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border/40 p-4">
          <p className="text-sm">
            <strong>Participants:</strong>{' '}
            {meeting.participants.map((p) => `${p.firstName} ${p.lastName ?? ''}`.trim()).join(', ') || '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {meeting.meetingType === 'online' ? meeting.meetingLink || 'Online' : meeting.location || 'In person'}
          </p>

          {canManage && meeting.status !== 'cancelled' && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-4">
              {rescheduling ? (
                <>
                  <Input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-56" />
                  <Button
                    size="sm"
                    disabled={!newDate || reschedule.isPending}
                    onClick={() => reschedule.mutate(new Date(newDate).toISOString(), { onSuccess: () => setRescheduling(false) })}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setRescheduling(true)}>Reschedule</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { if (window.confirm('Cancel this meeting? Every participant will be notified.')) cancel.mutate() }}
                    disabled={cancel.isPending}
                  >
                    Cancel meeting
                  </Button>
                </>
              )}
            </div>
          )}

          {meeting.mom ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">MOM</p>
              <p className="text-sm">{meeting.mom.summary || <span className="text-muted-foreground">No summary</span>}</p>
              <p className="text-sm">
                <strong>Present:</strong> {meeting.mom.attendeesPresent.map((e) => `${e.firstName} ${e.lastName ?? ''}`.trim()).join(', ') || '—'}
                {' · '}
                <strong>Absent:</strong> {meeting.mom.attendeesAbsent.map((e) => `${e.firstName} ${e.lastName ?? ''}`.trim()).join(', ') || '—'}
              </p>
              {meeting.mom.decisions.length > 0 && (
                <div><p className="text-xs font-semibold text-muted-foreground">Decisions</p><ul className="list-disc pl-5 text-sm">{meeting.mom.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
              )}
              {meeting.mom.actionItems.length > 0 && (
                <div><p className="text-xs font-semibold text-muted-foreground">Action items</p><ul className="list-disc pl-5 text-sm">{meeting.mom.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
              )}

              <div className="border-t border-border/40 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tasks from this MOM</p>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setAddTaskOpen(true)}>
                      <Plus className="mr-1.5 size-3.5" />
                      Add task
                    </Button>
                  )}
                </div>
                {meeting.spawnedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks created from this meeting yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {meeting.spawnedTasks.map((st, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{st.titleSnapshot}</span>{' '}
                        <Badge variant="outline" className="font-normal">{st.kind}</Badge>{' '}
                        {st.task?.status && <span className="text-xs text-muted-foreground">{st.task.status.replace(/_/g, ' ')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : canManage && meeting.status !== 'cancelled' ? (
            isPast ? (
              <MomForm clientId={client._id} meeting={meeting} />
            ) : (
              <p className="text-sm text-muted-foreground">The MOM can be added once this meeting's time has passed.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No MOM yet.</p>
          )}
        </div>
      )}

      <AddTaskFromMomDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} client={client} meetingId={meeting._id} />
    </div>
  )
}
