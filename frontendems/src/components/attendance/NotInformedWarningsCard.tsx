import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMonthlyWarnings } from '@/hooks/useAttendanceWarnings'
import { CATEGORY_LABEL, type WarningCategory } from '@/api/attendanceWarnings.api'

const CATEGORIES: WarningCategory[] = ['late', 'early_departure', 'half_day', 'short_leave', 'absent', 'single_scan']

const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Not-informed warning history — permanent, browsable month by month, never
// pruned once the month ends (mirrors the "keep data always" requirement).
// Sits alongside AttendanceSummaryCard on the Employee Detail page,
// admin/HR view only.
export function NotInformedWarningsCard({ employeeId }: { employeeId: string }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 })
  const { data, isLoading } = useMonthlyWarnings(employeeId, cursor.year, cursor.month)

  const goToPreviousMonth = () =>
    setCursor((c) => (c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 }))
  const goToNextMonth = () =>
    setCursor((c) => (c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 }))

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground">Not-Informed Warnings</h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium text-foreground">
            {MONTH_LABEL[cursor.month - 1]} {cursor.year}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 md:grid-cols-6">
            {CATEGORIES.map((category) => (
              <div key={category} className="flex flex-col gap-1">
                <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {data?.counts[category] ?? 0}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                  {CATEGORY_LABEL[category]}
                </p>
              </div>
            ))}
          </div>

          {data && data.warnings.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              {data.warnings.map((warning) => (
                <div key={warning._id} className="rounded-lg bg-secondary/40 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    {CATEGORY_LABEL[warning.category]} — {new Date(warning.date).toLocaleDateString()}
                    {warning.sentBy && <span className="font-normal text-muted-foreground"> · by {warning.sentBy.username}</span>}
                  </p>
                  <p className="text-muted-foreground">{warning.message}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
