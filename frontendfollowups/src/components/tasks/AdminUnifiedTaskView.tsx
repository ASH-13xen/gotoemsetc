import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeeSingleSelect } from '@/components/shared/EmployeeSingleSelect'
import { TeamSingleSelect } from '@/components/shared/TeamSingleSelect'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskStatusFilter, matchesStatusFilter, type StatusFilterValue } from '@/components/tasks/TaskStatusFilter'
import { useMyTasks, useAdminFilteredTasks } from '@/hooks/useEmployeeTasks'
import { useTaskClients } from '@/hooks/useTaskClients'
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

const NONE = '__none__'

// Client/team/employee/date — all four combinable at once, narrowing
// together rather than being mutually exclusive single-select filters.
export function AdminUnifiedTaskView() {
  const [clientId, setClientId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('pending')

  const { data: clientsData } = useTaskClients()
  const clients = clientsData?.clients ?? []

  const hasFilter = Boolean(clientId || teamId || employeeId || dateFrom || dateTo)
  const allTasks = useMyTasks()
  const filtered = useAdminFilteredTasks({
    clientId: clientId || undefined,
    teamId: teamId || undefined,
    employeeId: employeeId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const { data, isLoading } = hasFilter ? filtered : allTasks
  const tasks = data?.tasks ?? []

  const visibleTasks = useMemo(
    () => tasks.filter((task) => matchesStatusFilter(task, statusFilter)),
    [tasks, statusFilter]
  )

  const clearAll = () => {
    setClientId('')
    setTeamId('')
    setEmployeeId('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1">
          <Label className="text-xs">Client</Label>
          <Select value={clientId || NONE} onValueChange={(v) => setClientId(v === NONE ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="FILTER BY CLIENT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-56 space-y-1">
          <Label className="text-xs">Team</Label>
          <TeamSingleSelect
            key={teamId || 'team-empty'}
            value={teamId}
            onChange={setTeamId}
            placeholder="FILTER BY TEAM"
          />
        </div>

        <div className="w-56 space-y-1">
          <Label className="text-xs">Employee</Label>
          <EmployeeSingleSelect
            key={employeeId || 'employee-empty'}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="FILTER BY EMPLOYEE"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>

        {hasFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            <X className="size-3.5" />
            Clear all
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
