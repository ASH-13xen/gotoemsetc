import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskNav } from '@/components/layout/TaskNav'
import { TaskCard } from '@/components/tasks/TaskCard'
import { ClientTaskGroups } from '@/components/tasks/ClientTaskGroups'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { AdminUnifiedTaskView } from '@/components/tasks/AdminUnifiedTaskView'
import { TaskStatusFilter, matchesStatusFilter, type StatusFilterValue } from '@/components/tasks/TaskStatusFilter'
import { useAuth } from '@/hooks/useAuth'
import { canManageTasks, canViewUnifiedTasks } from '@/lib/permissions'
import { useMyTasks } from '@/hooks/useEmployeeTasks'
import { useLedTeams } from '@/hooks/useLedTeams'
import { cn } from '@/lib/utils'
import type { EmployeeTaskType } from '@/api/employeeTasks.api'

const SECTIONS: { type: EmployeeTaskType; heading: string }[] = [
  { type: 'personal', heading: 'Personal Tasks' },
  { type: 'team', heading: 'Team Tasks' },
  { type: 'client', heading: 'Client Related Tasks' },
  { type: 'event', heading: 'Event Related Tasks' },
]

export default function TaskListPage() {
  const { user } = useAuth()
  const isAdmin = canManageTasks(user)
  // Wider than isAdmin — CEO and the global Team Leader also get the
  // filterable, all-types-merged view (client/team/employee/date), without
  // gaining isAdmin's broader task-management authority (e.g. WorkTeam CRUD).
  const showUnifiedView = canViewUnifiedTasks(user)
  // A team leader can create Team tasks for their own team and Personal
  // tasks for people on it, even without the broad manage_tasks permission
  // — see backend/src/middlewares/taskAccess.middleware.js#requireCanCreateTopLevelTask.
  const ledTeams = useLedTeams()
  const canCreateTask = isAdmin || ledTeams.length > 0
  const { data, isLoading } = useMyTasks()
  const tasks = data?.tasks ?? []
  const [activeFilters, setActiveFilters] = useState<Set<EmployeeTaskType>>(
    () => new Set(SECTIONS.map((s) => s.type))
  )
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('pending')

  const grouped = useMemo(() => {
    const map: Record<EmployeeTaskType, typeof tasks> = { personal: [], team: [], client: [], event: [] }
    for (const task of tasks.filter((t) => matchesStatusFilter(t, statusFilter))) map[task.type].push(task)
    return map
  }, [tasks, statusFilter])

  const toggleFilter = (type: EmployeeTaskType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      // Never let every chip turn off — that would just look broken/empty.
      return next.size === 0 ? new Set(SECTIONS.map((s) => s.type)) : next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <TaskNav />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">Tasks</h1>
          {canCreateTask && <CreateTaskDialog />}
        </div>

        {showUnifiedView ? (
          <AdminUnifiedTaskView />
        ) : (
          <>
            <TaskStatusFilter value={statusFilter} onChange={setStatusFilter} />

            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <button
                  key={section.type}
                  type="button"
                  onClick={() => toggleFilter(section.type)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-all',
                    activeFilters.has(section.type)
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/70'
                  )}
                >
                  {section.type}
                </button>
              ))}
            </div>

            {isLoading ? (
              <Skeleton className="h-32 w-full rounded-2xl bg-secondary/40" />
            ) : (
              <div className="space-y-10">
                {SECTIONS.filter((section) => activeFilters.has(section.type)).map((section) => (
                  <div key={section.type} className="space-y-3">
                    <h2 className="text-lg font-extrabold uppercase tracking-wide text-foreground">{section.heading}</h2>
                    {section.type === 'client' ? (
                      <ClientTaskGroups tasks={grouped.client} />
                    ) : grouped[section.type].length === 0 ? (
                      <p className="text-sm text-muted-foreground">No {section.heading.toLowerCase()} yet.</p>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {grouped[section.type].map((task) => (
                          <TaskCard key={task._id} task={task} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
