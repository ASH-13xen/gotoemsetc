import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useAcknowledgeLeaveApplicationOnDashboard, useMyAttendanceRequests } from '@/hooks/useAttendanceRequests'
import {
  HALF_DAY_PERIOD_LABEL,
  leaveApplicationLabel,
  type AttendanceModificationRequest,
  type AttendanceRequestStatus,
} from '@/api/attendanceRequests.api'

// pending -> nobody's acted yet (still content_manager or hr stage).
// resolved -> approved and applied. rejected -> denied. revoked -> was
// approved, later undone by HR — shown distinctly rather than folded into
// "denied" since it was granted once. See
// backend/src/config/constants.js#ATTENDANCE_REQUEST_STATUS.
// Once decided, the employee can Acknowledge it, which takes it off this
// card — it stays under "Show all leave applications".
function StatusBadge({ status }: { status: AttendanceRequestStatus }) {
  if (status === 'resolved') return <Badge variant="success">Approved</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Denied</Badge>
  if (status === 'revoked') return <Badge variant="destructive">Revoked</Badge>
  return <Badge variant="warning">Pending</Badge>
}

function formatDateRange(date: string, endDate: string) {
  const start = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (date === endDate) return start
  const end = new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${start} – ${end}`
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function Row({ request, onDashboard }: { request: AttendanceModificationRequest; onDashboard: boolean }) {
  const acknowledge = useAcknowledgeLeaveApplicationOnDashboard()
  const decided = request.status !== 'pending'
  return (
    <div className="min-w-0 rounded-xl bg-secondary/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {leaveApplicationLabel(request) || 'Modification request'}
            {request.requestedHalfDayPeriod && ` — ${HALF_DAY_PERIOD_LABEL[request.requestedHalfDayPeriod]}`}
          </p>
          <p className="truncate text-xs text-muted-foreground">{formatDateRange(request.date, request.endDate)}</p>
          {!onDashboard && (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">{request.reason}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                Applied {fmt(request.createdAt)}
                {request.dashboardAcknowledgedAt ? ` · Acknowledged ${fmt(request.dashboardAcknowledgedAt)}` : ''}
              </p>
            </>
          )}
        </div>
        <StatusBadge status={request.status} />
      </div>
      {request.status === 'rejected' && request.rejectionReason && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Reason: {request.rejectionReason}</p>
      )}
      {decided && !request.dashboardAcknowledgedAt && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          disabled={acknowledge.isPending}
          onClick={() =>
            acknowledge.mutate(request._id, {
              onSuccess: () => toast.success('Acknowledged — moved to your full list'),
              onError: () => toast.error('Could not acknowledge this application'),
            })
          }
        >
          <Check className="size-3.5" /> Acknowledge
        </Button>
      )}
    </div>
  )
}

// Covers every type the Apply dialog can file (Short Leave, Late, Half Day,
// Leave, Work From Home) plus the free-text "Request Modification" flow —
// same underlying AttendanceModificationRequest model either way, so one
// widget shows everything this employee has applied for and not yet
// acknowledged.
export function MyLeaveApplicationsCard() {
  const { data, isLoading } = useMyAttendanceRequests()
  const [allOpen, setAllOpen] = useState(false)
  const requests = data?.requests ?? []
  const open = requests.filter((r) => !r.dashboardAcknowledgedAt)

  return (
    <DashboardCard icon={<CalendarPlus className="size-4" />} title="My leave applications">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : open.length === 0 ? (
        <DashboardCardEmpty
          icon={<CalendarPlus className="size-4" />}
          message={requests.length === 0 ? 'No leave applications filed yet.' : 'Nothing open — every application is acknowledged.'}
        />
      ) : (
        <div className="grid max-h-72 min-w-0 grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto pr-0.5">
          {open.map((r) => (
            <Row key={r._id} request={r} onDashboard />
          ))}
        </div>
      )}
      {requests.length > 0 && (
        <Button size="sm" variant="ghost" className="mt-3 w-full text-primary" onClick={() => setAllOpen(true)}>
          Show all leave applications
        </Button>
      )}

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All my leave applications</DialogTitle>
            <DialogDescription>Everything you have applied for, newest first.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {[...requests]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((r) => (
                <Row key={r._id} request={r} onDashboard={false} />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardCard>
  )
}
