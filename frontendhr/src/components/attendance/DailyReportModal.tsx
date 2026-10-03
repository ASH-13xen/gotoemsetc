import { useState } from 'react'
import { AlarmClock, Ban, CalendarClock, Fingerprint, LogOut, TimerOff, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDailyReport } from '@/hooks/useAttendanceWarnings'
import { WarningRow } from './WarningRow'
import { formatPunchTime } from './formatPunchTime'
import { CATEGORY_LABEL, type WarningCategory } from '@/api/attendanceWarnings.api'

const WARNABLE_CATEGORIES: WarningCategory[] = [
  'late',
  'early_departure',
  'half_day',
  'short_leave',
  'absent',
  'single_scan',
]

// One icon + tint per category — same "soft tint, not a heavy fill" language
// as attendance's own STATUS_CONFIG, so this report reads as part of the
// same design system instead of a bare, unstyled dump of tables.
const CATEGORY_META: Record<WarningCategory, { icon: LucideIcon; badge: string; icon_: string }> = {
  late: { icon: AlarmClock, badge: 'bg-orange-500/10', icon_: 'text-orange-600' },
  early_departure: { icon: LogOut, badge: 'bg-rose-500/10', icon_: 'text-rose-600' },
  half_day: { icon: CalendarClock, badge: 'bg-amber-500/10', icon_: 'text-amber-600' },
  short_leave: { icon: TimerOff, badge: 'bg-red-500/10', icon_: 'text-red-600' },
  absent: { icon: Ban, badge: 'bg-neutral-500/10', icon_: 'text-neutral-600' },
  single_scan: { icon: Fingerprint, badge: 'bg-violet-500/10', icon_: 'text-violet-600' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}

// report.date is a UTC-midnight day-only value (see backend's utcMidnight) —
// getUTCDay is the correct check, not the browser's local getDay.
function isSunday(iso: string) {
  return new Date(iso).getUTCDay() === 0
}

export function DailyReportModal({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)
  const { data, isLoading } = useDailyReport(selectedDate)
  const report = data?.report
  const sunday = report ? isSunday(report.date) : false

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] w-full max-w-[95vw] overflow-y-auto sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Daily Attendance Report{report ? ` — ${formatDate(report.date)}` : ''}</DialogTitle>
        </DialogHeader>

        {report && report.recentWorkingDays.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Working day:</span>
            {report.recentWorkingDays.map((day) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={report.date === day ? 'default' : 'outline'}
                onClick={() => setSelectedDate(day)}
              >
                {formatDayLabel(day)}
              </Button>
            ))}
          </div>
        )}

        {isLoading || !report ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-secondary/40" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {sunday && (
              <Card className="border-sky-500/20 bg-sky-500/5 p-4">
                <p className="text-sm font-medium text-sky-900">
                  Sunday isn't a scheduled work day, so Late/Absent/Half Day/Short Leave/Single Scan aren't tracked
                  here — only overtime, below, for anyone who came in anyway.
                </p>
              </Card>
            )}

            {!sunday && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {WARNABLE_CATEGORIES.map((category) => {
                  const rows = report[category]
                  const meta = CATEGORY_META[category]
                  const Icon = meta.icon
                  return (
                    <Card key={category} className="gap-0 overflow-hidden p-0">
                      <div className="flex items-center gap-2.5 border-b border-border bg-secondary/30 px-4 py-3">
                        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', meta.badge)}>
                          <Icon className={cn('size-4', meta.icon_)} />
                        </span>
                        <h3 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[category]}</h3>
                        <Badge variant={rows.length > 0 ? 'warning' : 'outline'} className="ml-auto">
                          {rows.length}
                        </Badge>
                      </div>
                      {rows.length === 0 ? (
                        <p className="px-4 py-5 text-center text-xs text-muted-foreground">All clear.</p>
                      ) : (
                        <div className="max-h-80 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>First scan</TableHead>
                                <TableHead>Last scan</TableHead>
                                <TableHead>Not informed</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rows.map((row) => (
                                <WarningRow key={row.employee._id} row={row} category={category} date={report.date} compact />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}

            <Card className="gap-0 overflow-hidden p-0">
              <div className="flex items-center gap-2.5 border-b border-border bg-secondary/30 px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="size-4 text-emerald-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Present + Overtime</h3>
                <Badge variant="outline" className="ml-auto">
                  {report.present_overtime.length}
                </Badge>
              </div>
              {report.present_overtime.length === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-muted-foreground">No overtime logged.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>First scan</TableHead>
                      <TableHead>Last scan</TableHead>
                      <TableHead>Overtime minutes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.present_overtime.map((row) => (
                      <TableRow key={row.employee._id}>
                        <TableCell className="font-semibold text-foreground">
                          {row.employee.firstName} {row.employee.lastName ?? ''}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.employee.designation}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatPunchTime(row.firstPunchAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatPunchTime(row.lastPunchAt)}</TableCell>
                        <TableCell className="font-medium text-foreground">{row.record.overtimeMinutes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
