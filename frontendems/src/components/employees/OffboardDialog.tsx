import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface OffboardDetails {
  endDate: string
  reasonForLeaving: string
  removedFromGroupsAndReels: boolean
  mailDeactivated: boolean
}

// Picking "Offboarded" in the Status dropdown opens this instead of changing
// the status straight away — the employee is only off-boarded once these
// details are filled in and confirmed. The last working day is required:
// it decides their final salary slip, and the backend refuses to off-board
// without one (see employee.service.js#assertOffboardingHasLastDay).
export function OffboardDialog({
  open,
  onOpenChange,
  employeeName,
  initial,
  isPending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  initial: OffboardDetails
  isPending: boolean
  onConfirm: (details: OffboardDetails) => void
}) {
  const [details, setDetails] = useState<OffboardDetails>(initial)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    if (open) {
      setDetails(initial)
      setShowErrors(false)
    }
    // Reset only when the dialog opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const missingDate = !details.endDate
  const missingReason = !details.reasonForLeaving.trim()

  const onSubmit = () => {
    if (missingDate || missingReason) {
      setShowErrors(true)
      return
    }
    onConfirm({ ...details, reasonForLeaving: details.reasonForLeaving.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Off-board {employeeName}?</DialogTitle>
          <DialogDescription>
            Fill in the off-boarding details. Once confirmed, their status changes to Offboarded and their EMS login is
            deactivated immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="offboardEndDate">Last working day *</Label>
            <Input
              id="offboardEndDate"
              type="date"
              value={details.endDate}
              onChange={(e) => setDetails({ ...details, endDate: e.target.value })}
            />
            {showErrors && missingDate && <p className="text-xs text-destructive">Last working day is required.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offboardReason">Reason for leaving *</Label>
            <Input
              id="offboardReason"
              className="uppercase"
              value={details.reasonForLeaving}
              onChange={(e) => setDetails({ ...details, reasonForLeaving: e.target.value })}
            />
            {showErrors && missingReason && <p className="text-xs text-destructive">Reason for leaving is required.</p>}
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm select-none">
            <input
              type="checkbox"
              checked={details.removedFromGroupsAndReels}
              onChange={(e) => setDetails({ ...details, removedFromGroupsAndReels: e.target.checked })}
              className="size-4 cursor-pointer rounded border-border accent-primary"
            />
            Removed from groups + Go-To Reels
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm select-none">
            <input
              type="checkbox"
              checked={details.mailDeactivated}
              onChange={(e) => setDetails({ ...details, mailDeactivated: e.target.checked })}
              className="size-4 cursor-pointer rounded border-border accent-primary"
            />
            Mail deactivated
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Confirm off-boarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
