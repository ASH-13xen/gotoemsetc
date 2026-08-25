import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMyUnseenAttendanceOutcomes, useAcknowledgeAttendanceRequest } from '@/hooks/useAttendanceRequests'
import { LEAVE_APPLICATION_STATUS_LABEL, type AttendanceRequestStatus } from '@/api/attendanceRequests.api'

const OUTCOME_LABEL: Partial<Record<AttendanceRequestStatus, string>> = {
  resolved: 'Approved',
  rejected: 'Rejected',
  revoked: 'Revoked',
}

const OUTCOME_BADGE_VARIANT: Partial<Record<AttendanceRequestStatus, 'success' | 'destructive' | 'warning'>> = {
  resolved: 'success',
  rejected: 'destructive',
  revoked: 'warning',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Shown on the dashboard the moment the logged-in employee has any leave
// application (the structured "apply for leave" flow, not the free-text
// one) that reached a final outcome they haven't acknowledged yet — same
// blocking-until-acknowledged pattern as PendingWarningsModal. Backend
// self-scopes to req.user.employeeLink and returns an empty list for
// accounts with no linked employee, so this is safe to mount unconditionally.
export function AttendanceOutcomeModal() {
  const { data } = useMyUnseenAttendanceOutcomes()
  const outcomes = data?.requests ?? []
  const acknowledge = useAcknowledgeAttendanceRequest()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (outcomes.length > 0) setOpen(true)
  }, [outcomes.length])

  const onAcknowledge = () => {
    for (const outcome of outcomes) acknowledge.mutate(outcome._id)
    setOpen(false)
  }

  if (outcomes.length === 0) return null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Leave application update</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {outcomes.map((outcome) => (
            <div key={outcome._id} className="rounded-xl bg-secondary/40 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant={OUTCOME_BADGE_VARIANT[outcome.status] ?? 'default'}>
                  {OUTCOME_LABEL[outcome.status] ?? outcome.status}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">
                  {outcome.endDate && outcome.endDate.slice(0, 10) !== outcome.date.slice(0, 10)
                    ? `${formatDate(outcome.date)} – ${formatDate(outcome.endDate)}`
                    : formatDate(outcome.date)}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {outcome.requestedStatus && LEAVE_APPLICATION_STATUS_LABEL[outcome.requestedStatus]} — {outcome.reason}
              </p>
              {outcome.status === 'rejected' && outcome.rejectionReason && (
                <p className="mt-2 text-xs text-muted-foreground">Reason: {outcome.rejectionReason}</p>
              )}
              {outcome.status === 'revoked' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  This approval was later revoked and your attendance for this date was restored.
                </p>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onAcknowledge} disabled={acknowledge.isPending} className="w-full">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
