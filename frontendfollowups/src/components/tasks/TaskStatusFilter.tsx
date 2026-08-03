import { cn } from '@/lib/utils'
import type { EmployeeTask, EmployeeTaskStatus } from '@/api/employeeTasks.api'

export type StatusFilterValue = EmployeeTaskStatus | 'all'

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'for_review', label: 'For Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

// 'pending' already covers "overdue" — overdue is just a pending task past
// its endAt (see TaskStatusBadge), not a separate persisted status — so
// this one bucket satisfies "only show pending/overdue by default."
export function matchesStatusFilter(task: EmployeeTask, filter: StatusFilterValue): boolean {
  return filter === 'all' || task.status === filter
}

export function TaskStatusFilter({
  value,
  onChange,
}: {
  value: StatusFilterValue
  onChange: (value: StatusFilterValue) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
