import { useState } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddMeetingDialog } from './AddMeetingDialog'
import { useMeetings } from '@/hooks/useMeetings'

export function MeetingHistoryList({ clientId }: { clientId: string }) {
  const { data, isLoading } = useMeetings(clientId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const meetings = data?.meetings ?? []

  return (
    <div className="border-2 border-white bg-black p-6 space-y-6">
      <div className="flex items-center justify-between border-b-2 border-white pb-3">
        <h2 className="text-2xl font-black tracking-widest text-white uppercase">Meeting History</h2>
        <AddMeetingDialog clientId={clientId} />
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full bg-neutral-800" />
      ) : meetings.length === 0 ? (
        <p className="text-sm font-bold tracking-widest text-neutral-400 uppercase">
          No meetings logged yet.
        </p>
      ) : (
        <div className="divide-y-2 divide-neutral-900">
          {meetings.map((meeting) => {
            const isOpen = Boolean(expanded[meeting._id])
            return (
              <div key={meeting._id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs font-bold tracking-widest text-neutral-400 uppercase">
                    {new Date(meeting.meetingDate).toLocaleString()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpanded((prev) => ({ ...prev, [meeting._id]: !isOpen }))}
                  >
                    <Users className="size-3.5" />
                    {isOpen ? 'Hide Members' : 'Show Members'}
                  </Button>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-white">{meeting.mom}</p>
                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {meeting.attendees.length === 0 ? (
                      <span className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                        No employees recorded for this meeting.
                      </span>
                    ) : (
                      meeting.attendees.map((emp) => (
                        <span
                          key={emp._id}
                          className="border-2 border-white px-3 py-1 text-xs font-bold tracking-wide text-white uppercase"
                        >
                          {emp.firstName} {emp.lastName}
                          {emp.designation && <span className="text-neutral-400"> · {emp.designation}</span>}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
