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
  { key: 'current', label: 'Current month' },
  { key: 'previous', label: 'Previous month' },
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

// A colored tile — used for both per-status counts (tone taken from
// STATUS_CONFIG's `box`) and the neutral/derived stats, so every number on
// this card reads as a distinct block rather than a plain list of figures.
function StatBox({
  label,
  value,
  tone,
  code,
}: {
  label: string
  value: number
  tone: string
  code?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-xl border p-4', tone)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        {code && <span className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-bold">{code}</span>}
      </div>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}

const NEUTRAL_TONE = 'border-border bg-secondary/40 text-foreground'
const PENALTY_TONE = 'border-amber-500/25 bg-amber-500/10 text-amber-700'
const OVERTIME_TONE = 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700'

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
    <Card className="gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Attendance</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {period === 'overall' && !summary?.dateOfJoining
              ? 'No date of joining on file'
              : summary
                ? `${new Date(summary.periodStart).toLocaleDateString()} – ${new Date(summary.asOfDate).toLocaleDateString()}`
                : ''}
          </p>
        </div>
        {showViewFullButton && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/attendance/${employeeId}`)}>
            <CalendarCheck className="size-4" />
            View full attendance
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
            onClick={() => setPeriod(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : period === 'overall' && !summary?.dateOfJoining ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-amber-700">
          <TriangleAlert className="size-5 shrink-0" />
          <p className="text-sm font-medium">
            Set a date of joining on this employee to start tracking attendance totals.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            <StatBox label="Working days" value={summary?.totalWorkingDays ?? 0} tone={NEUTRAL_TONE} />
            <StatBox label="Unmarked" value={summary?.unmarkedDays ?? 0} tone={NEUTRAL_TONE} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, (typeof STATUS_CONFIG)[AttendanceStatus]][]).map(
              ([key, cfg]) => (
                <StatBox key={key} label={cfg.label} code={cfg.code} value={summary?.counts[key] ?? 0} tone={cfg.box} />
              )
            )}
          </div>

          {/* Stacking visibility — a day can be an arrival-side Short Leave
              AND an early departure at once; these surface that instead of
              it silently looking like "just 1 SL" above. */}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            <StatBox label="Early departures" value={summary?.earlyDepartureCount ?? 0} tone={PENALTY_TONE} />
            <StatBox label="Effective SL units" value={summary?.effectiveSLUnits ?? 0} tone={PENALTY_TONE} />
            <StatBox label="Half-day penalty units" value={summary?.halfDayPenaltyUnits ?? 0} tone={PENALTY_TONE} />
            <StatBox label="Overtime (minutes)" value={summary?.totalOvertimeMinutes ?? 0} tone={OVERTIME_TONE} />
          </div>
        </>
      )}
    </Card>
  )
}
