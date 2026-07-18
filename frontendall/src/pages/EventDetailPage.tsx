import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarClock, CheckCircle2, MapPin, Pencil, Plus, Video, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useCancelEvent, useCompleteEvent, useEvent } from '@/hooks/useEvents'
import { EventFormDialog } from '@/components/events/EventFormDialog'
import { RescheduleDialog } from '@/components/events/RescheduleDialog'
import { ResponsibilityFormDialog } from '@/components/events/ResponsibilityFormDialog'
import { ResponsibilityRow } from '@/components/events/ResponsibilityRow'
import { SummaryDialog } from '@/components/events/SummaryDialog'
import type { EventStatus } from '@/api/events.api'

const STATUS_VARIANT: Record<EventStatus, 'secondary' | 'success' | 'destructive'> = {
  upcoming: 'secondary',
  completed: 'success',
  cancelled: 'destructive',
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'hr'

  const { data, isLoading } = useEvent(id)
  const completeEvent = useCompleteEvent(id ?? '')
  const cancelEvent = useCancelEvent(id ?? '')

  const [editOpen, setEditOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const { event, responsibilities } = data

  const onComplete = () => {
    completeEvent.mutate(undefined, {
      onSuccess: () => toast.success('Event marked completed'),
      onError: () => toast.error('Could not update this event'),
    })
  }

  const onCancel = () => {
    if (!window.confirm('Cancel this event?')) return
    cancelEvent.mutate(undefined, {
      onSuccess: () => toast.success('Event cancelled'),
      onError: () => toast.error('Could not cancel this event'),
    })
  }

  return (
    <div className="space-y-6 py-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate('/events')}>
        <ArrowLeft className="size-3.5" />
        Back to events
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">{event.title}</h1>
            <Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>
          </div>
          {event.description && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{event.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          {event.status === 'upcoming' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setRescheduleOpen(true)}>
                <CalendarClock className="size-3.5" />
                Postpone / prepone
              </Button>
              <Button variant="outline" size="sm" onClick={onComplete} disabled={completeEvent.isPending}>
                <CheckCircle2 className="size-3.5" />
                Mark completed
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel} disabled={cancelEvent.isPending}>
                <XCircle className="size-3.5" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">When</p>
          <p className="mt-1 text-sm">{new Date(event.startAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Where</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            {event.mode === 'online' ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
            {event.location || (event.mode === 'online' ? 'Online' : 'Offline')}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Coordinator</p>
          <p className="mt-1 text-sm">{event.coordinator ? `${event.coordinator.firstName} ${event.coordinator.lastName ?? ''}` : '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client</p>
          <p className="mt-1 text-sm">{event.client?.clientName ?? 'Not tied to a client'}</p>
        </div>
      </div>

      {event.rescheduleHistory.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Reschedule history</p>
          {event.rescheduleHistory.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {new Date(r.fromStartAt).toLocaleDateString()} → {new Date(r.toStartAt).toLocaleDateString()}
              {r.note ? ` — ${r.note}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Responsibilities</h2>
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <Plus className="size-3.5" />
            Assign responsibility
          </Button>
        </div>
        {responsibilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing assigned yet.</p>
        ) : (
          <div className="grid gap-2">
            {responsibilities.map((r) => (
              <ResponsibilityRow key={r._id} responsibility={r} eventId={event._id} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Event summary</h2>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setSummaryOpen(true)}>
              <Pencil className="size-3.5" />
              {event.summary?.highlights || event.summary?.improvements ? 'Edit summary' : 'Add summary'}
            </Button>
          )}
        </div>
        {!event.summary?.highlights && !event.summary?.improvements ? (
          <p className="text-sm text-muted-foreground">No summary yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-emerald-700">What went well</p>
              <p className="text-sm text-foreground/90">{event.summary?.highlights || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700">What needs improvement</p>
              <p className="text-sm text-foreground/90">{event.summary?.improvements || '—'}</p>
            </div>
          </div>
        )}
      </div>

      <EventFormDialog open={editOpen} onOpenChange={setEditOpen} event={event} />
      <RescheduleDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen} event={event} />
      <ResponsibilityFormDialog open={assignOpen} onOpenChange={setAssignOpen} eventId={event._id} />
      <SummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} event={event} />
    </div>
  )
}
