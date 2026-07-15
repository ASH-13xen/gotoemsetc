import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateBooking } from '@/hooks/useInventory'
import { useEvents } from '@/hooks/useEvents'
import { useClientDirectory, useClientTasks } from '@/hooks/useClients'
import type { BookingContext, InventoryItem } from '@/api/inventory.api'

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function BookingDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem
}) {
  const createBooking = useCreateBooking(item._id)
  const { data: events } = useEvents()
  const { data: clients } = useClientDirectory()

  const [quantity, setQuantity] = useState('1')
  const [startDate, setStartDate] = useState(todayInputValue())
  const [endDate, setEndDate] = useState(todayInputValue())
  const [context, setContext] = useState<BookingContext>('other')
  const [eventId, setEventId] = useState('')
  const [clientId, setClientId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: clientTasks, isError: clientTasksError } = useClientTasks(context === 'client_task' ? clientId : undefined)

  const onSubmit = () => {
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error('Enter a valid quantity')
      return
    }
    if (context === 'event' && !eventId) {
      toast.error('Select an event')
      return
    }
    if (context === 'client_task' && !taskId) {
      toast.error("Select the client's task")
      return
    }

    createBooking.mutate(
      {
        quantity: qty,
        startDate,
        endDate,
        context,
        event: context === 'event' ? eventId : undefined,
        clientTask: context === 'client_task' ? taskId : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Locked ${qty} × ${item.name}`)
          onOpenChange(false)
        },
        onError: (err) => {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          toast.error(message || 'Could not book this item')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book "{item.name}"</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">{item.availableQuantity} of {item.totalQuantity} currently available.</p>

          <div className="grid grid-cols-3 gap-2">
            <div className="grid gap-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} max={item.availableQuantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Until</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Select value={context} onValueChange={(v) => setContext(v as BookingContext)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">An event</SelectItem>
                <SelectItem value="client_task">A client's task</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {context === 'event' && (
            <div className="grid gap-1.5">
              <Label>Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event…" />
                </SelectTrigger>
                <SelectContent>
                  {(events ?? []).map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {context === 'client_task' && (
            <>
              <div className="grid gap-1.5">
                <Label>Client</Label>
                <Select
                  value={clientId}
                  onValueChange={(v) => {
                    setClientId(v)
                    setTaskId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {clientId && (
                <div className="grid gap-1.5">
                  <Label>Task</Label>
                  {clientTasksError ? (
                    <p className="text-xs text-muted-foreground">You're not assigned to this client's tasks.</p>
                  ) : (
                    <Select value={taskId} onValueChange={setTaskId}>
                      <SelectTrigger>
                        <SelectValue placeholder={clientTasks?.length ? 'Select a task…' : 'No current tasks'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(clientTasks ?? []).map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.sectionName} — {t.itemLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid gap-1.5">
            <Label>Additional details (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createBooking.isPending}>
            {createBooking.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Lock item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
