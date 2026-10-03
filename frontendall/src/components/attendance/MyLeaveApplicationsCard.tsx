import { CalendarPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { useMyAttendanceRequests } from '@/hooks/useAttendanceRequests'
import {
  HALF_DAY_PERIOD_LABEL,
  leaveApplicationLabel,
  type AttendanceRequestStatus,
} from '@/api/attendanceRequests.api'

// pending -> nobody's acted yet (still content_manager or hr stage).
// resolved -> approved and applied. rejected -> denied. revoked -> was
// approved, later undone by HR — shown distinctly rather than folded into
// "denied" since it was granted once. See
// backend/src/config/constants.js#ATTENDANCE_REQUEST_STATUS.
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

// Covers every type the Apply dialog can file (Short Leave, Late, Half Day,
// Leave, Work From Home) plus the free-text "Request Modification" flow —
// same underlying AttendanceModificationRequest model either way, so one
// widget shows everything this employee has ever applied for.
export function MyLeaveApplicationsCard() {
  const { data, isLoading } = useMyAttendanceRequests()
  const requests = data?.requests ?? []

  return (
    <DashboardCard icon={<CalendarPlus className="size-4" />} title="My leave applications">
      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-xl" />
      ) : requests.length === 0 ? (
        <DashboardCardEmpty icon={<CalendarPlus className="size-4" />} message="No leave applications filed yet." />
      ) : (
        <div className="grid gap-2 max-h-72 overflow-y-auto pr-0.5">
          {requests.slice(0, 8).map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {leaveApplicationLabel(r) || 'Modification request'}
                  {r.requestedHalfDayPeriod && ` — ${HALF_DAY_PERIOD_LABEL[r.requestedHalfDayPeriod]}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">{formatDateRange(r.date, r.endDate)}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
