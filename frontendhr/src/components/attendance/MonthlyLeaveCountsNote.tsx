import { cn } from '@/lib/utils'
import type { MonthlyLeaveCounts } from '@/api/attendanceRequests.api'

type CountedType = 'SL' | 'L' | 'H'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

// The month-to-date Late / Short Leave / Half Day tally — shown to the
// employee while applying, and to whoever approves on each request. Counted
// the same way payroll does (see attendanceRequest.service.js
// #computeMonthlyCounts), so an evening Short Leave (early departure) is
// already inside the Short Leave number.
export function MonthlyLeaveCountsNote({
  counts,
  highlight,
  title = 'Already this month',
}: {
  counts: MonthlyLeaveCounts
  highlight?: CountedType
  title?: string
}) {
  const items: { key: CountedType; label: string; detail?: string; pending: number }[] = [
    {
      key: 'SL',
      label: plural(counts.shortLeave, 'Short Leave'),
      detail: counts.earlyDeparture > 0 ? `incl. ${counts.earlyDeparture} in 2nd half` : undefined,
      pending: counts.pending.shortLeave,
    },
    { key: 'L', label: plural(counts.late, 'Late'), pending: counts.pending.late },
    { key: 'H', label: plural(counts.halfDay, 'Half Day'), pending: counts.pending.halfDay },
  ]

  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <span
            key={item.key}
            className={cn('text-muted-foreground', item.key === highlight && 'font-semibold text-foreground')}
          >
            {item.label}
            {item.detail && ` (${item.detail})`}
            {item.pending > 0 && ` · ${item.pending} pending`}
          </span>
        ))}
      </div>
    </div>
  )
}
