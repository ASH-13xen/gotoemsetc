import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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

export function DailyReportModal({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)
  const { data, isLoading } = useDailyReport(selectedDate)
  const report = data?.report

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
          <div className="space-y-8">
            {WARNABLE_CATEGORIES.map((category) => {
              const rows = report[category]
              return (
                <section key={category} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {CATEGORY_LABEL[category]} ({rows.length})
                  </h3>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>First scan</TableHead>
                          <TableHead>Last scan</TableHead>
                          <TableHead>Not informed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <WarningRow key={row.employee._id} row={row} category={category} date={report.date} />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>
              )
            })}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Present + Overtime ({report.present_overtime.length})
              </h3>
              {report.present_overtime.length === 0 ? (
                <p className="text-xs text-muted-foreground">None.</p>
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
                        <TableCell>{row.record.overtimeMinutes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
