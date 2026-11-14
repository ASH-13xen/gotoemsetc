import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AttendanceSummaryCard } from './AttendanceSummaryCard'
import { AttendanceCalendar } from './AttendanceCalendar'

// The attendance totals and the calendar, sharing one month: moving the
// calendar to another month shows that month's totals beside it.
// `side`: the two boxes next to each other, the same size (the employee
// profile); otherwise stacked (the full attendance page).
export function AttendancePair({ employeeId, side = false, showViewFullButton = true }: { employeeId: string; side?: boolean; showViewFullButton?: boolean }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })
  return (
    <div className={cn('grid gap-4', side && 'grid-cols-1 items-stretch lg:grid-cols-2')}>
      <AttendanceSummaryCard employeeId={employeeId} compact={side} month={month} showViewFullButton={showViewFullButton} />
      <AttendanceCalendar employeeId={employeeId} compact={side} month={month} onMonthChange={setMonth} />
    </div>
  )
}
