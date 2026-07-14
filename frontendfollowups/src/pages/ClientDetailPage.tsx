import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { FileWarning, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'

import { NavBar } from '@/components/layout/NavBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { TaskCard } from '@/components/tasks/TaskCard'
import { useClient, useAssignClientTeam } from '@/hooks/useClients'
import { useTeams } from '@/hooks/useTeams'
import { useSyncClientCycle, useTasksForClient } from '@/hooks/useTasks'
import type { Task } from '@/api/tasks.api'

const NO_TEAM = '__none__'

function baseLabel(itemLabel: string) {
  return itemLabel.replace(/\s#\d+$/, '')
}

function SectionProgress({ tasks }: { tasks: Task[] }) {
  const bySectionAndBase = useMemo(() => {
    const map = new Map<string, { section: string; base: string; total: number; done: number }>()
    for (const task of tasks) {
      const key = `${task.sectionName}::${baseLabel(task.itemLabel)}`
      const entry = map.get(key) ?? { section: task.sectionName, base: baseLabel(task.itemLabel), total: 0, done: 0 }
      entry.total += 1
      if (task.status === 'done') entry.done += 1
      map.set(key, entry)
    }
    return [...map.values()]
  }, [tasks])

  if (bySectionAndBase.length === 0) return null

  return (
    <div className="grid gap-2 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
      {bySectionAndBase.map((entry) => (
        <div key={`${entry.section}-${entry.base}`} className="grid gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">{entry.base}</span>
            <span className="text-muted-foreground">
              {entry.done}/{entry.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${entry.total ? (entry.done / entry.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useClient(id)
  const { data: teamsData } = useTeams()
  const assignTeam = useAssignClientTeam(id ?? '')

  const [cycleId, setCycleId] = useState<string | undefined>(undefined)
  const tasksQuery = useTasksForClient(id, cycleId)
  const syncCycle = useSyncClientCycle(id ?? '')

  const client = data?.client
  const teams = teamsData?.teams ?? []

  if (isLoading || !client || !id) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="mx-auto max-w-5xl space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  const onTeamChange = (value: string) => {
    assignTeam.mutate(value === NO_TEAM ? null : value, {
      onSuccess: () => toast.success('Team updated'),
      onError: () => toast.error('Could not update team'),
    })
  }

  const notAssigned = isAxiosError(tasksQuery.error) && tasksQuery.error.response?.status === 403

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter uppercase">{client.clientName}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground uppercase">{client.brandName}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Team</span>
            <Select value={client.assignedTeam?._id ?? NO_TEAM} onValueChange={onTeamChange}>
              <SelectTrigger className="h-9 w-56 rounded-lg border font-medium normal-case tracking-normal">
                <SelectValue placeholder="No team assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>No team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team._id} value={team._id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!client.currentQuotation ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center shadow-sm">
            <FileWarning className="size-10 text-muted-foreground" />
            <p className="text-lg font-bold">No signed quotation yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tasks are generated from a client's signed quotation's Scope of Work. Generate and sign one in
              Client Management first.
            </p>
            <a href={`/sales/clients/${id}`} className="text-sm font-semibold text-primary hover:underline">
              Go to Client Management →
            </a>
          </div>
        ) : notAssigned ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-10 text-center shadow-sm">
            <ShieldAlert className="size-10 text-muted-foreground" />
            <p className="text-lg font-bold">You're not assigned to this client</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Only employees assigned to this client (or admins) can see its tasks.
            </p>
          </div>
        ) : tasksQuery.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Select
                value={tasksQuery.data?.cycle?._id ?? ''}
                onValueChange={(v) => setCycleId(v)}
              >
                <SelectTrigger className="h-9 w-64">
                  <SelectValue placeholder="Select a cycle" />
                </SelectTrigger>
                <SelectContent>
                  {(tasksQuery.data?.cycles ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      Cycle {c.cycleNumber} · {new Date(c.startDate).toLocaleDateString()} –{' '}
                      {new Date(c.endDate).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  syncCycle.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success(result.tasks.length > 0 ? `Generated ${result.tasks.length} task(s)` : 'Already up to date'),
                    onError: () => toast.error('Could not sync tasks'),
                  })
                }
                disabled={syncCycle.isPending}
              >
                {syncCycle.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Sync tasks now
              </Button>
            </div>

            {tasksQuery.data && tasksQuery.data.tasks.length > 0 && <SectionProgress tasks={tasksQuery.data.tasks} />}

            {!tasksQuery.data?.cycle ? (
              <p className="text-sm text-muted-foreground">No cycle yet — click "Sync tasks now" to generate one.</p>
            ) : tasksQuery.data.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This cycle has no tasks — the quotation's template may not have a Scope of Work configured yet.
              </p>
            ) : (
              Object.entries(
                tasksQuery.data.tasks.reduce<Record<string, Task[]>>((acc, task) => {
                  ;(acc[task.sectionName] ??= []).push(task)
                  return acc
                }, {})
              ).map(([sectionName, tasks]) => (
                <div key={sectionName} className="grid gap-3">
                  <h2 className="text-lg font-bold tracking-tight">{sectionName}</h2>
                  {tasks.map((task) => (
                    <TaskCard key={task._id} task={task} clientId={id} />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </main>
    </div>
  )
}
