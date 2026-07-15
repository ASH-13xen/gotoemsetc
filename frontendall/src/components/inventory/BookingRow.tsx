import { toast } from 'sonner'
import { Loader2, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useReleaseBooking } from '@/hooks/useInventory'
import type { InventoryBooking } from '@/api/inventory.api'

function fmt(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}

function bookerName(booking: InventoryBooking) {
  return booking.bookedBy ? `${booking.bookedBy.firstName} ${booking.bookedBy.lastName ?? ''}`.trim() : 'Admin'
}

function contextLabel(booking: InventoryBooking) {
  if (booking.context === 'event') return booking.event ? `Event: ${booking.event.title}` : 'Event'
  if (booking.context === 'client_task') {
    return booking.clientTask
      ? `${booking.clientTask.client?.clientName ?? 'Client'} — ${booking.clientTask.itemLabel}`
      : "Client's task"
  }
  return 'Other'
}

function releaseLabel(booking: InventoryBooking) {
  if (booking.status === 'active') return null
  if (booking.releasedByRole === 'employee') {
    return `Checked in by ${booking.releasedBy ? `${booking.releasedBy.firstName} ${booking.releasedBy.lastName ?? ''}`.trim() : '—'} on ${fmt(booking.releasedAt)}`
  }
  return booking.releasedEarly
    ? `Unlocked early by admin on ${fmt(booking.releasedAt)}`
    : `Opened by admin on ${fmt(booking.releasedAt)}`
}

export function BookingRow({ booking, itemId }: { booking: InventoryBooking; itemId: string }) {
  const release = useReleaseBooking(itemId)
  const isOverdue = booking.status === 'active' && new Date(booking.endDate) < new Date()

  const onRelease = () => {
    release.mutate(booking._id, {
      onSuccess: () => toast.success('Booking released'),
      onError: (err) => {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(message || 'Could not release this booking')
      },
    })
  }

  return (
    <div className="grid gap-1 rounded-lg border border-border/60 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {booking.status === 'active' ? (
            <Lock className="size-3.5 text-amber-600" />
          ) : (
            <Unlock className="size-3.5 text-emerald-600" />
          )}
          <span className="text-sm font-semibold">
            {booking.quantity}× — {booking.status === 'active' ? `Locked by ${bookerName(booking)}` : releaseLabel(booking)}
          </span>
          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
        </div>
        {booking.status === 'active' && (
          <Button size="sm" variant="outline" onClick={onRelease} disabled={release.isPending}>
            {release.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Unlock className="size-3.5" />}
            Check in / unlock
          </Button>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {fmt(booking.startDate)} – {fmt(booking.endDate)} · {contextLabel(booking)}
        {booking.notes ? ` · ${booking.notes}` : ''}
      </div>
    </div>
  )
}
