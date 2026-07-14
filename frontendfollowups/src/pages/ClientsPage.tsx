import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'

import { NavBar } from '@/components/layout/NavBar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { useClients } from '@/hooks/useClients'

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useClients({ search: search || undefined, limit: 100 })
  const clients = data?.items ?? []

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter uppercase">Task Management</h1>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clients found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <button
                key={client._id}
                onClick={() => navigate(`/clients/${client._id}`)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40">
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Building2 className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{client.clientName}</p>
                    <p className="truncate text-sm text-muted-foreground">{client.brandName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <ClientStatusBadge status={client.status} />
                  {client.mainEmployee && (
                    <span className="text-xs text-muted-foreground">
                      {client.mainEmployee.firstName} {client.mainEmployee.lastName ?? ''}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
