import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRejectItem } from '@/hooks/useCms'
import type { CalendarItem } from '@/api/cms.api'

// Red — terminal, closes the item for everyone, per spec. A reason is
// required, and this asks again with an explicit warning before it commits,
// since there's no undoing it afterwards.
export function RejectDialog({
  open,
  onOpenChange,
  item,
  calendarId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CalendarItem
  calendarId: string
}) {
  const reject = useRejectItem(calendarId)
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  function close(open: boolean) {
    if (!open) {
      setReason('')
      setConfirming(false)
    }
    onOpenChange(open)
  }

  function submit() {
    if (!reason.trim()) return
    reject.mutate(
      { id: item._id, reason: reason.trim() },
      { onSuccess: () => close(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {item.label}?</DialogTitle>
          <DialogDescription>
            This closes the item for everyone — it can no longer be worked on, and it never counts as
            delivered. This can't be undone.
          </DialogDescription>
        </DialogHeader>

        {!confirming ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea
                id="reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being rejected?"
              />
              <p className="text-xs text-muted-foreground">Required.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setConfirming(true)} disabled={!reason.trim()}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Are you sure? Rejecting <strong>{item.label}</strong> closes it permanently — it cannot be
                reopened.
              </span>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button variant="destructive" onClick={submit} disabled={reject.isPending}>
                {reject.isPending ? 'Rejecting…' : 'Yes, reject it'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
