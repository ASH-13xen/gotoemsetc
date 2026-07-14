import { useState } from 'react'
import { Users } from 'lucide-react'
import { NavBar } from '@/components/layout/NavBar'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkloadForEmployee, useWorkloadSummary } from '@/hooks/useTaskDashboard'

export default function WorkloadPage() {
  const { data, isLoading } = useWorkloadSummary()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const { data: detail } = useWorkloadForEmployee(selectedId)

  const summary = data?.summary ?? []
  const maxCount = Math.max(1, ...summary.map((s) => s.activeCount))

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tighter uppercase">
          <Users className="size-6" />
          Workload
        </h1>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active tasks assigned to anyone right now.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-2">
              {summary.map(({ employee, activeCount }) => (
                <button
                  key={employee._id}
                  onClick={() => setSelectedId(employee._id)}
                  className={`grid gap-1 rounded-lg border p-3 text-left transition-colors ${
                    selectedId === employee._id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {employee.firstName} {employee.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{activeCount} active</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(activeCount / maxCount) * 100}%` }} />
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              {!selectedId ? (
                <p className="text-sm text-muted-foreground">Select someone to see what they're working on.</p>
              ) : (
                (detail?.tasks ?? []).map((task) => (
                  <div key={task._id} className="rounded-lg border border-border bg-card p-3 text-sm">
                    <p className="font-semibold">{task.itemLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeof task.client === 'object' ? task.client.clientName : ''} · {task.sectionName} ·{' '}
                      {task.status.replace('_', ' ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
