import { useMemo, useState } from 'react'
import { Clock } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useMonthlyOverview } from '@/hooks/useAttendance'
import { STATUS_CONFIG } from '@/components/attendance/statusConfig'
import type { MonthlyOverviewRecord } from '@/api/attendance.api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKey(iso: string) {
  return iso.slice(0, 10)
}

function employeeName(r: MonthlyOverviewRecord) {
  return `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim()
}

export default function AttendanceOverviewPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getUTCMonth() + 1)
  const [year, setYear] = useState(now.getUTCFullYear())
  const [showOvertime, setShowOvertime] = useState(false)
  const { data, isLoading } = useMonthlyOverview(month, year)
  const records = data?.records ?? []

  const byDate = useMemo(() => {
    const map = new Map<string, MonthlyOverviewRecord[]>()
    for (const r of records) {
      const key = dateKey(r.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }, [records])

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="All merged attendance"
        description="Every employee who was late, absent, on leave, or worked overtime — one month at a glance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => now.getUTCFullYear() - 3 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showOvertime ? 'default' : 'outline'}
              onClick={() => setShowOvertime((v) => !v)}
            >
              <Clock className="size-4" />
              Overtime {showOvertime ? 'on' : 'off'}
            </Button>
          </div>
        }
      />

      {/* This is a dense, 7-column-wide report — on a narrow screen it
          scrolls horizontally as one unit (min-w-227.5 keeps every day
          column at a legible ~130px) rather than squeezing each day down to
          an unreadable sliver. */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="grid min-w-227.5 grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid min-w-227.5 grid-cols-7 gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-1 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} />
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayRecords = byDate.get(key) ?? []
              const notable = dayRecords.filter((r) => r.status && r.status !== 'P')
              const overtime = dayRecords.filter((r) => r.overtimeMinutes > 0)

              return (
                <div key={key} className="flex min-h-32 flex-col gap-1.5 rounded-xl border border-border bg-card p-2">
                  <p className="text-xs font-bold text-foreground">{day}</p>
                  <div className="flex flex-col gap-1 overflow-y-auto">
                    {notable.map((r) => {
                      const cfg = r.status ? STATUS_CONFIG[r.status] : undefined
                      return (
                        <div key={r._id} className="flex items-center gap-1.5 text-[11px]">
                          <span className={cn('size-1.5 shrink-0 rounded-full', cfg?.dot ?? 'bg-muted-foreground')} />
                          <span className="truncate text-foreground">{employeeName(r)}</span>
                          <span className="shrink-0 font-bold text-muted-foreground">{r.status}</span>
                        </div>
                      )
                    })}
                    {showOvertime &&
                      overtime.map((r) => (
                        <div key={`ot-${r._id}`} className="flex items-center gap-1.5 text-[11px] text-primary">
                          <Clock className="size-3 shrink-0" />
                          <span className="truncate">{employeeName(r)}</span>
                          <span className="shrink-0 font-bold">+{r.overtimeMinutes}m</span>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
