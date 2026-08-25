import { useState } from 'react'
import { CalendarPlus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMeetingsForClient } from '@/hooks/useMeetings'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog'
import { MeetingCard } from './MeetingCard'
import type { Client } from '@/api/cms.api'

export function MeetingsPanel({ client }: { client: Client }) {
  const { data: meetings, isLoading } = useMeetingsForClient(client._id)
  // Mirrors the CMS write bar for the UI's purposes — the server enforces
  // the real Team Main/global Team Leader/CEO rule regardless.
  const { canManageCalendar } = useCmsAccess()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const sorted = [...(meetings ?? [])].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())

  return (
    <div className="space-y-4">
      {canManageCalendar && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setScheduleOpen(true)}>
            <CalendarPlus className="mr-1.5 size-4" />
            Schedule meeting
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
            <ClipboardList className="mr-1.5 size-4" />
            Log a past meeting
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((meeting) => (
            <MeetingCard key={meeting._id} client={client} meeting={meeting} />
          ))}
        </div>
      )}

      <ScheduleMeetingDialog open={scheduleOpen} onOpenChange={setScheduleOpen} client={client} mode="schedule" />
      <ScheduleMeetingDialog open={logOpen} onOpenChange={setLogOpen} client={client} mode="log" />
    </div>
  )
}
