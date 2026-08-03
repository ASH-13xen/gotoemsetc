import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { TeamSingleSelect } from '@/components/shared/TeamSingleSelect'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskStatusFilter, matchesStatusFilter, type StatusFilterValue } from '@/components/tasks/TaskStatusFilter'
import { useMyTasks, useAdminFilteredTasks } from '@/hooks/useEmployeeTasks'
import { cn } from '@/lib/utils'
import type { EmployeeTask, EmployeeTaskType } from '@/api/employeeTasks.api'

// One consistent color per type, reused across the whole admin view — same
// color language as the frontendems dashboard tiles (blue/violet/emerald/
// amber) so the two apps read as one system.
const TYPE_ACCENT: Record<EmployeeTaskType, string> = {
  personal: 'border-l-blue-600',
  team: 'border-l-violet-600',
  client: 'border-l-emerald-600',
  event: 'border-l-amber-600',
}

type FilterMode = { kind: 'none' } | { kind: 'employee'; id: string } | { kind: 'team'; id: string }

export function AdminUnifiedTaskView() {
  const [filter, setFilter] = useState<FilterMode>({ kind: 'none' })
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('pending')

  const allTasks = useMyTasks()
  const filtered = useAdminFilteredTasks({
    employeeId: filter.kind === 'employee' ? filter.id : undefined,
    teamId: filter.kind === 'team' ? filter.id : undefined,
  })

  const { data, isLoading } = filter.kind === 'none' ? allTasks : filtered
  const tasks = data?.tasks ?? []

  const visibleTasks = useMemo(
    () => tasks.filter((task) => matchesStatusFilter(task, statusFilter)),
    [tasks, statusFilter]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          {/* Keyed on the filter itself so clearing (or switching straight
              from one employee/team to another) always remounts a fresh
              Select — Radix's Select.Value can otherwise keep showing the
              last-selected label after the value resets programmatically,
              since it doesn't get set via an actual click in the list. */}
          <EmployeeSingleSelect
            key={filter.kind === 'employee' ? filter.id : 'employee-empty'}
            value={filter.kind === 'employee' ? filter.id : ''}
            onChange={(id) => setFilter({ kind: 'employee', id })}
            placeholder="FILTER BY EMPLOYEE"
          />
        </div>
        <div className="w-56">
          <TeamSingleSelect
            key={filter.kind === 'team' ? filter.id : 'team-empty'}
            value={filter.kind === 'team' ? filter.id : ''}
            onChange={(id) => setFilter({ kind: 'team', id })}
            placeholder="FILTER BY TEAM"
          />
        </div>
        {filter.kind !== 'none' && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setFilter({ kind: 'none' })}>
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} />

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks match this filter.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleTasks.map((task: EmployeeTask) => (
            <div key={task._id} className={cn('rounded-2xl border-l-4', TYPE_ACCENT[task.type])}>
              <TaskCard task={task} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
