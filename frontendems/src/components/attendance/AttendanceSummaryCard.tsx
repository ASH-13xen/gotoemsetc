import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAttendanceSummary } from '@/hooks/useAttendance'
import { STATUS_CONFIG } from './statusConfig'
import type { AttendanceStatus } from '@/api/attendance.api'

type Period = 'current' | 'previous' | 'overall'

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'current', label: 'Current Month' },
  { key: 'previous', label: 'Previous Month' },
  { key: 'overall', label: 'Overall' },
]

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// [1st of this month, today] — UTC, matching the backend's UTC-midnight
// day convention (see attendance.service.js).
function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return { from: dateKey(from), to: dateKey(now) }
}

function previousMonthRange(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  return { from: dateKey(from), to: dateKey(to) }
}

// Attendance totals for a selectable period (Current/Previous Month, or
// lifetime-since-joining "Overall") — distinct from the month-by-month
// calendar this sits alongside, which is where day-by-day marking/browsing
// happens. `showViewFullButton` is turned off when this card is already
// rendered on the full attendance page itself (AttendancePage.tsx), where
// the button would otherwise just navigate to the page it's already on.
export function AttendanceSummaryCard({
  employeeId,
  showViewFullButton = true,
}: {
  employeeId: string
  showViewFullButton?: boolean
}) {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('current')
  const range = period === 'current' ? currentMonthRange() : period === 'previous' ? previousMonthRange() : undefined
  const { data, isLoading } = useAttendanceSummary(employeeId, range)
  const summary = data?.summary

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Attendance</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {period === 'overall' && !summary?.dateOfJoining
              ? 'No date of joining on file'
              : summary
                ? `${new Date(summary.periodStart).toLocaleDateString()} – ${new Date(summary.asOfDate).toLocaleDateString()}`
                : ''}
          </p>
        </div>
        {showViewFullButton && (
          <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/attendance/${employeeId}`)}>
            <CalendarCheck className="size-4" />
            View Full Attendance
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant={period === opt.key ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => setPeriod(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : period === 'overall' && !summary?.dateOfJoining ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700">
          <TriangleAlert className="size-5 shrink-0" />
          <p className="text-sm font-bold">
            Set a date of joining on this employee to start tracking attendance totals.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-primary/10 text-primary p-4">
              <p className="text-3xl font-extrabold leading-none tracking-tight">{summary?.totalWorkingDays ?? 0}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest">Working Days</p>
            </div>
            <div className="rounded-xl bg-secondary text-secondary-foreground p-4">
              <p className="text-3xl font-extrabold leading-none tracking-tight">{summary?.unmarkedDays ?? 0}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest">Unmarked</p>
            </div>
            {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
              ([key, cfg]) => (
                <div key={key} className={cn('rounded-xl p-4', cfg.solid)}>
                  <p className="text-3xl font-extrabold leading-none tracking-tight">{summary?.counts[key] ?? 0}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest">{cfg.label}</p>
                </div>
              )
            )}
          </div>

          {/* Stacking visibility — a day can be an arrival-side Short Leave
              AND an early departure at once; these tiles surface that instead
              of it silently looking like "just 1 SL" above. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 border-t border-border/15 pt-4">
            <div className="rounded-xl bg-red-500/10 text-red-700 p-4">
              <p className="text-2xl font-extrabold leading-none tracking-tight">{summary?.earlyDepartureCount ?? 0}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest">Early Departures</p>
            </div>
            <div className="rounded-xl bg-red-500/10 text-red-700 p-4">
              <p className="text-2xl font-extrabold leading-none tracking-tight">{summary?.effectiveSLUnits ?? 0}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest">Effective SL Units</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 text-amber-700 p-4">
              <p className="text-2xl font-extrabold leading-none tracking-tight">{summary?.halfDayPenaltyUnits ?? 0}</p>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest">Half-Day Penalty Units</p>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
