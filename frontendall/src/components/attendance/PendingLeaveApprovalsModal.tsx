import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMyPendingCmReviews, useCmApproveRequest, useCmRejectRequest } from '@/hooks/useAttendanceRequests'
import { LEAVE_APPLICATION_STATUS_LABEL, type AttendanceModificationRequest } from '@/api/attendanceRequests.api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function formatRange(request: AttendanceModificationRequest) {
  if (request.endDate.slice(0, 10) === request.date.slice(0, 10)) return formatDate(request.date)
  return `${formatDate(request.date)} – ${formatDate(request.endDate)}`
}

function employeeName(request: AttendanceModificationRequest) {
  return typeof request.employee === 'string'
    ? request.employee
    : `${request.employee.firstName} ${request.employee.lastName ?? ''}`.trim()
}

function RequestCard({ request }: { request: AttendanceModificationRequest }) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const approve = useCmApproveRequest()
  const reject = useCmRejectRequest()

  const onApprove = () => {
    approve.mutate(request._id, {
      onSuccess: () => toast.success('Approved — now with HR for final review'),
      onError: () => toast.error('Could not approve this request'),
    })
  }

  const onReject = () => {
    reject.mutate(
      { id: request._id, reason: rejectReason.trim() || undefined },
      {
        onSuccess: () => toast.success('Application rejected'),
        onError: () => toast.error('Could not reject this request'),
      }
    )
  }

  return (
    <div className="space-y-3 rounded-xl bg-secondary/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{employeeName(request)}</p>
          <p className="text-xs text-muted-foreground">{formatRange(request)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {request.requestedStatus && <Badge variant="outline">{LEAVE_APPLICATION_STATUS_LABEL[request.requestedStatus]}</Badge>}
          {request.requestedEarlyDeparture && <Badge variant="outline">Early Departure</Badge>}
        </div>
      </div>
      <p className="text-sm text-foreground/80">{request.reason}</p>

      {!rejecting ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={approve.isPending} className="flex-1">
            <CheckCircle2 className="size-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} className="flex-1">
            <XCircle className="size-4" />
            Reject
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejecting (optional)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={onReject} disabled={reject.isPending} className="flex-1">
              Confirm reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Shown to an employee, on the dashboard, the moment a leave application
// from someone on a team they're tagged Content Manager on needs their
// review — the first of the two approval stages, before it ever reaches
// HR. Same self-mounting, blocking-dialog pattern as
// PendingWarningsModal/ComplaintReviewModal, but each item keeps its own
// independent Approve/Reject actions rather than one combined dismiss —
// closes itself automatically once every pending item has been acted on.
export function PendingLeaveApprovalsModal() {
  const { data } = useMyPendingCmReviews()
  const requests = data?.requests ?? []

  if (requests.length === 0) return null

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Leave application{requests.length > 1 ? 's' : ''} awaiting your review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard key={request._id} request={request} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
