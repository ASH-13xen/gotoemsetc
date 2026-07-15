import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents'
import { useClientDirectory } from '@/hooks/useClients'
import { useEmployeeDirectory } from '@/hooks/useEmployees'
import type { EventItem, EventMode } from '@/api/events.api'

const NO_CLIENT = '__none__'
const NO_COORDINATOR = '__none__'

function toDateTimeLocal(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: EventItem
}) {
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent(event?._id ?? '')
  const { data: clients } = useClientDirectory()
  const { data: employees } = useEmployeeDirectory()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState(NO_CLIENT)
  const [mode, setMode] = useState<EventMode>('offline')
  const [location, setLocation] = useState('')
  const [startAt, setStartAt] = useState('')
  const [coordinator, setCoordinator] = useState(NO_COORDINATOR)

  useEffect(() => {
    if (!open) return
    setTitle(event?.title ?? '')
    setDescription(event?.description ?? '')
    setClientId(event?.client?._id ?? NO_CLIENT)
    setMode(event?.mode ?? 'offline')
    setLocation(event?.location ?? '')
    setStartAt(toDateTimeLocal(event?.startAt) || toDateTimeLocal(new Date().toISOString()))
    setCoordinator(event?.coordinator?._id ?? NO_COORDINATOR)
  }, [open, event])

  const isEdit = Boolean(event)
  const isPending = createEvent.isPending || updateEvent.isPending

  const onSubmit = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!startAt) {
      toast.error('Pick a date & time')
      return
    }

    const input = {
      title: title.trim(),
      description: description.trim() || undefined,
      client: clientId === NO_CLIENT ? null : clientId,
      mode,
      location: location.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
      coordinator: coordinator === NO_COORDINATOR ? null : coordinator,
    }

    const onSuccess = () => {
      toast.success(isEdit ? 'Event updated' : 'Event created')
      onOpenChange(false)
    }
    const onError = () => toast.error(isEdit ? 'Could not update event' : 'Could not create event')

    if (isEdit) {
      updateEvent.mutate(input, { onSuccess, onError })
    } else {
      createEvent.mutate(input, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit event' : 'Create event'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Product Launch Meetup" />
          </div>

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-1.5">
            <Label>Client (optional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Not tied to a client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLIENT}>Not tied to a client</SelectItem>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as EventMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{mode === 'online' ? 'Meeting link' : 'Venue / place'}</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Event coordinator</Label>
            <Select value={coordinator} onValueChange={setCoordinator}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COORDINATOR}>None</SelectItem>
                {(employees ?? []).map((e) => (
                  <SelectItem key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
