import { useNavigate } from 'react-router-dom'
import { CalendarCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAttendanceSummary } from '@/hooks/useAttendance'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'

// Lifetime totals (from date of joining through today), not month-scoped —
// distinct from the month-by-month calendar this sits alongside, which is
// where day-by-day marking/browsing happens.
export function AttendanceSummaryCard({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useAttendanceSummary(employeeId)
  const summary = data?.summary

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Attendance</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {summary?.dateOfJoining
              ? `Since ${new Date(summary.dateOfJoining).toLocaleDateString()} · as of ${new Date(summary.asOfDate).toLocaleDateString()}`
              : 'No date of joining on file'}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/attendance/${employeeId}`)}>
          <CalendarCheck className="size-4" />
          View Full Attendance
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !summary?.dateOfJoining ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700">
          <TriangleAlert className="size-5 shrink-0" />
          <p className="text-sm font-bold">
            Set a date of joining on this employee to start tracking attendance totals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-primary/10 text-primary p-4">
            <p className="text-3xl font-extrabold leading-none tracking-tight">{summary.totalWorkingDays}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest">Working Days</p>
          </div>
          <div className="rounded-xl bg-secondary text-secondary-foreground p-4">
            <p className="text-3xl font-extrabold leading-none tracking-tight">{summary.unmarkedDays}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest">Unmarked</p>
          </div>
          {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
            ([key, cfg]) => (
              <div key={key} className={cn('rounded-xl p-4', cfg.solid)}>
                <p className="text-3xl font-extrabold leading-none tracking-tight">{summary.counts[key] ?? 0}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest">{cfg.label}</p>
              </div>
            )
          )}
        </div>
      )}
    </Card>
  )
}
