import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, Plus, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useEvents } from '@/hooks/useEvents'
import { EventFormDialog } from '@/components/events/EventFormDialog'
import type { EventStatus } from '@/api/events.api'

const STATUS_VARIANT: Record<EventStatus, 'secondary' | 'success' | 'destructive'> = {
  upcoming: 'secondary',
  completed: 'success',
  cancelled: 'destructive',
}

export default function EventsPage() {
  const { data: events, isLoading } = useEvents()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Event Management</h1>
          <p className="text-sm text-muted-foreground">Company events, who's responsible for what, and how they went.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create event
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-12 text-center">
          <CalendarClock className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No events yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event._id} to={`/events/${event._id}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <CardContent className="grid gap-2 p-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{event.title}</span>
                    <Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>
                  </div>
                  {event.client && <p className="text-xs text-muted-foreground">{event.client.clientName}</p>}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    {new Date(event.startAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {event.mode === 'online' ? <Video className="size-3" /> : <MapPin className="size-3" />}
                    {event.location || (event.mode === 'online' ? 'Online' : 'Offline')}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <EventFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
