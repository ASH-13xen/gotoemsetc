import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, CalendarClock } from 'lucide-react'
import { NavBar } from '@/components/layout/NavBar'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/useTaskDashboard'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useDashboard()

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Dashboard</h1>

        {isLoading || !data ? (
          <div className="grid gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <section className="grid gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="size-4 text-destructive" />
                Overdue ({data.overdue.length})
              </h2>
              {data.overdue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing overdue.</p>
              ) : (
                <div className="grid gap-2">
                  {data.overdue.map(({ task, step }) => (
                    <button
                      key={step._id}
                      onClick={() => navigate(`/clients/${typeof task.client === 'string' ? task.client : task.client._id}`)}
                      className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left text-sm hover:bg-destructive/10"
                    >
                      <span>
                        <strong>{step.label}</strong> — {task.itemLabel} ({task.sectionName})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {step.dueDate && new Date(step.dueDate).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CalendarClock className="size-4 text-primary" />
                Due this week ({data.dueThisWeek.length})
              </h2>
              {data.dueThisWeek.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due this week.</p>
              ) : (
                <div className="grid gap-2">
                  {data.dueThisWeek.map(({ task, step }) => (
                    <button
                      key={step._id}
                      onClick={() => navigate(`/clients/${typeof task.client === 'string' ? task.client : task.client._id}`)}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-left text-sm hover:bg-secondary/40"
                    >
                      <span>
                        <strong>{step.label}</strong> — {task.itemLabel} ({task.sectionName})
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {step.dueDate && new Date(step.dueDate).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Building2 className="size-4" />
                Completion by client
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.completionByClient.map(({ client, total, done, rate }) => (
                  <button
                    key={client._id}
                    onClick={() => navigate(`/clients/${client._id}`)}
                    className="grid gap-1 rounded-lg border border-border bg-card p-3 text-left hover:bg-secondary/40"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{client.clientName}</span>
                      <span className="text-xs text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${rate * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
