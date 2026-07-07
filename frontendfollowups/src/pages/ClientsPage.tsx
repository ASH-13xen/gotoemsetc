import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

import { NavBar } from '@/components/layout/NavBar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { useClients } from '@/hooks/useClients'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])
  return debounced
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isLoading } = useClients({ search: debouncedSearch || undefined, limit: 50 })
  const clients = data?.items ?? []

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Clients</h1>

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-4 size-5 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            className="pl-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto border-2 border-foreground">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground uppercase">
              No clients yet — register one in the Sales app.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow
                    key={client._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/clients/${client._id}`)}
                  >
                    <TableCell className="font-bold uppercase">{client.clientName}</TableCell>
                    <TableCell className="uppercase">{client.brandName}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {new Date(client.dateRegistered).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
