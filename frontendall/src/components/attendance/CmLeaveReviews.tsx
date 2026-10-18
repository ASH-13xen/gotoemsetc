import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck2, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMyPendingCmReviews, useCmApproveRequest, useCmRejectRequest } from '@/hooks/useAttendanceRequests'
import {
  HALF_DAY_PERIOD_LABEL,
  leaveApplicationLabel,
  type AttendanceModificationRequest,
} from '@/api/attendanceRequests.api'
import { MonthlyLeaveCountsNote } from './MonthlyLeaveCountsNote'

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

  const apiMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  const onApprove = () => {
    approve.mutate(request._id, {
      onSuccess: () => toast.success('Approved — now with HR for final review'),
      onError: (err) => toast.error(apiMessage(err, 'Could not approve this request')),
    })
  }

  const onReject = () => {
    reject.mutate(
      { id: request._id, reason: rejectReason.trim() || undefined },
      {
        onSuccess: () => toast.success("Rejected — it ends here and won't go to HR. They've been told."),
        onError: (err) => toast.error(apiMessage(err, 'Could not reject this request')),
      }
    )
  }
  const label = leaveApplicationLabel(request) || 'Modification request'

  return (
    <div className="space-y-3 rounded-xl bg-secondary/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{employeeName(request)}</p>
          <p className="text-xs text-muted-foreground">{formatRange(request)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant="outline">{label}</Badge>
          {request.requestedHalfDayPeriod && (
            <Badge variant="outline">{HALF_DAY_PERIOD_LABEL[request.requestedHalfDayPeriod]}</Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground/80">{request.reason}</p>
      {request.monthlyCounts && <MonthlyLeaveCountsNote counts={request.monthlyCounts} />}

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
            placeholder="Reason for rejecting (optional — they will see it)"
            rows={2}
          />
          <p className="text-[11px] text-muted-foreground">Rejecting ends it here — it does not go to HR.</p>
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

// A content manager's review list — leave applications and modification
// requests from their team in the Organisation chart, before they reach HR.
// Lives in the Action centre (no longer a blocking pop-up); shows nothing
// when there's nothing to review.
export function CmLeaveReviews() {
  const { data } = useMyPendingCmReviews()
  const requests = data?.requests ?? []

  if (requests.length === 0) return null

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-sky-500/40 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-sky-500/[0.07] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow">
          <CalendarCheck2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Leave & modification requests from your team</p>
          <p className="text-xs text-muted-foreground">Approve to pass it on to HR, or reject — a rejection ends it there.</p>
        </div>
        <span className="rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-black text-white">{requests.length}</span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {requests.map((request) => (
          <RequestCard key={request._id} request={request} />
        ))}
      </div>
    </div>
  )
}
