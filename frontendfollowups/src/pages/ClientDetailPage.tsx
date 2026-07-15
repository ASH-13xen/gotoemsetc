import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { ChevronDown, ChevronUp, FileWarning, Layers, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'

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
import { AddManualTaskDialog } from '@/components/tasks/AddManualTaskDialog'
import { ClientChatPanel } from '@/components/clients/ClientChatPanel'
import { ClientChatAccessEditor } from '@/components/clients/ClientChatAccessEditor'
import { useClient, useAssignClientTeam } from '@/hooks/useClients'
import { useTeams } from '@/hooks/useTeams'
import { useAuth } from '@/hooks/useAuth'
import { useSyncClientCycle, useTasksForClient } from '@/hooks/useTasks'
import type { Task } from '@/api/tasks.api'

const NO_TEAM = '__none__'

// "Stories #10" -> 10 — items are numbered in generation order but the
// label is a string, so sorting on the label alone would put "#10" before
// "#2". Single (un-numbered) deliverables sort first via 0.
function itemNumber(itemLabel: string) {
  const match = /#(\d+)$/.exec(itemLabel)
  return match ? Number(match[1]) : 0
}

// One collapsible block per section (e.g. "Reels", "Stories") showing a
// compact tile grid — a daily-exploded deliverable with dozens of instances
// stays scannable as a grid instead of a wall of stacked, expanded cards.
function SectionBlock({ sectionName, tasks, clientId }: { sectionName: string; tasks: Task[]; clientId: string }) {
  const sorted = useMemo(() => [...tasks].sort((a, b) => itemNumber(a.itemLabel) - itemNumber(b.itemLabel)), [tasks])
  const [open, setOpen] = useState(tasks.length <= 12)
  const done = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <span className="text-base font-bold tracking-tight">{sectionName}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {done}/{tasks.length}
            </span>
          </div>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sorted.map((task) => (
            <TaskCard key={task._id} task={task} clientId={clientId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
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
        <main className="mx-auto max-w-6xl space-y-4 p-6">
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
  const sections = tasksQuery.data
    ? Object.entries(
        tasksQuery.data.tasks.reduce<Record<string, Task[]>>((acc, task) => {
          ;(acc[task.sectionName] ??= []).push(task)
          return acc
        }, {})
      )
    : []

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight">{client.clientName}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground">{client.brandName}</p>
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Team</span>
            <Select value={client.assignedTeam?._id ?? NO_TEAM} onValueChange={onTeamChange}>
              <SelectTrigger className="h-9 w-56">
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

        <div className="grid gap-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Chat</h2>
            {isAdmin && <ClientChatAccessEditor clientId={id} currentAllowed={client.chatAllowedEmployees} />}
          </div>
          <ClientChatPanel clientId={id} />
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <Select
                value={tasksQuery.data?.cycle?._id ?? ''}
                onValueChange={(v) => setCycleId(v)}
              >
                <SelectTrigger className="h-9 w-full sm:w-80">
                  <SelectValue placeholder="Select a cycle" />
                </SelectTrigger>
                <SelectContent>
                  {(tasksQuery.data?.cycles ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.kind === 'one_time' ? (
                        <>Batch {c.cycleNumber} · {new Date(c.startDate).toLocaleDateString()} (one-time)</>
                      ) : (
                        <>
                          Cycle {c.cycleNumber} · {new Date(c.startDate).toLocaleDateString()} –{' '}
                          {c.endDate ? new Date(c.endDate).toLocaleDateString() : '—'}
                        </>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
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
                {isAdmin && tasksQuery.data?.cycle && <AddManualTaskDialog clientId={id} />}
              </div>
            </div>

            {!tasksQuery.data?.cycle ? (
              <p className="text-sm text-muted-foreground">No cycle yet — click "Sync tasks now" to generate one.</p>
            ) : tasksQuery.data.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This cycle has no tasks — the quotation's template may not have a Scope of Work configured yet.
              </p>
            ) : (
              sections.map(([sectionName, sectionTasks]) => (
                <SectionBlock key={sectionName} sectionName={sectionName} tasks={sectionTasks} clientId={id} />
              ))
            )}
          </>
        )}
      </main>
    </div>
  )
}
