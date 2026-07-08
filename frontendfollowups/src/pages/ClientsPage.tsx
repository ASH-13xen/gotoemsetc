import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

import { NavBar } from '@/components/layout/NavBar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { TaskPriorityBadge } from '@/components/tasks/TaskPriorityBadge'
import { useClients } from '@/hooks/useClients'
import { useDueSummary } from '@/hooks/useTasks'
import type { TaskPriority } from '@/api/tasks.api'

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useClients({ search: search || undefined, limit: 100 })
  const clients = useMemo(() => data?.items ?? [], [data])
  const clientIds = useMemo(() => clients.map((c) => c._id), [clients])
  const { data: dueSummaryData } = useDueSummary(clientIds)

  const dueByClient = useMemo(() => {
    const map = new Map<string, { title: string; priority: TaskPriority; dueDate: string }>()
    for (const item of dueSummaryData?.items ?? []) map.set(item._id, item)
    return map
  }, [dueSummaryData])

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const dueA = dueByClient.get(a._id)?.dueDate
      const dueB = dueByClient.get(b._id)?.dueDate
      if (!dueA && !dueB) return 0
      if (!dueA) return 1
      if (!dueB) return -1
      return new Date(dueA).getTime() - new Date(dueB).getTime()
    })
  }, [clients, dueByClient])

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Clients</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : sortedClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients found.</p>
        ) : (
          <div className="grid gap-3">
            {sortedClients.map((client) => {
              const due = dueByClient.get(client._id)
              return (
                <button
                  key={client._id}
                  onClick={() => navigate(`/clients/${client._id}`)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{client.clientName}</span>
                      <ClientStatusBadge status={client.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{client.brandName}</p>
                    {client.assignedTeam && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Team: {client.assignedTeam.name}
                        {client.assignedTeam.leader &&
                          ` (Lead: ${client.assignedTeam.leader.firstName} ${client.assignedTeam.leader.lastName ?? ''})`}
                      </p>
                    )}
                  </div>
                  {due ? (
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-sm font-medium">{due.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(due.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <TaskPriorityBadge priority={due.priority} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No tasks due</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
