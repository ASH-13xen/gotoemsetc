import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCog, Search, Users2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ClientStatusBadge } from '@/components/clients/ClientStatusBadge'
import { RegisterClientDialog } from '@/components/clients/RegisterClientDialog'
import { useClients } from '@/hooks/useClients'
import type { ClientStatus } from '@/api/clients.api'

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
  const [status, setStatus] = useState<ClientStatus | 'all'>('all')
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data, isLoading } = useClients({
    search: debouncedSearch || undefined,
    status: status === 'all' ? undefined : status,
    limit: 50,
  })

  const clients = data?.items ?? []

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 gap-6 bg-transparent md:grid-cols-3">
          <div className="flex min-h-[180px] flex-col justify-between bg-card border border-border p-8 rounded-2xl md:col-span-2 shadow-sm">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              SALES PIPELINE
            </span>
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground uppercase select-none md:text-7xl">
              CLIENTS
            </h1>
          </div>
          <div className="flex flex-col gap-4">
            <RegisterClientDialog
              trigger={
                <div className="flex min-h-[100px] cursor-pointer flex-col justify-between bg-emerald-600 p-6 rounded-xl text-white hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-90">NEW LEAD</span>
                  <span className="text-2xl font-extrabold tracking-wide uppercase">REGISTER CLIENT</span>
                </div>
              }
            />
            <div
              onClick={() => navigate('/quotation-templates')}
              className="flex min-h-[80px] cursor-pointer flex-col justify-center gap-1 bg-card border border-border p-6 rounded-xl shadow-sm hover:shadow hover:bg-secondary/40 active:scale-[0.99] transition-all"
            >
              <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground uppercase">
                <FileCog className="size-4 text-primary" />
                Quotation Templates
              </span>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-card border border-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
          <div className="relative flex items-center md:col-span-2">
            <Search className="pointer-events-none absolute left-4 z-10 size-5 text-muted-foreground/60" />
            <Input
              placeholder="Search by client or brand name..."
              className="h-12 border border-border bg-card pl-12 text-base font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus | 'all')}>
            <SelectTrigger className="h-12 border border-border bg-card text-base font-medium text-foreground focus:border-primary rounded-lg uppercase">
              <SelectValue placeholder="FILTER BY STATUS" />
            </SelectTrigger>
            <SelectContent className="border border-border bg-card text-foreground rounded-lg">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="lead">LEAD</SelectItem>
              <SelectItem value="onboarded">ONBOARDED</SelectItem>
              <SelectItem value="offboarded">OFFBOARDED</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CLIENTS TABLE */}
        <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-sm">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted/40 rounded-lg" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Users2 className="size-16 text-muted-foreground/40" />
              <p className="text-xl font-bold tracking-tight text-foreground">No clients yet</p>
              <p className="text-sm tracking-wider text-muted-foreground uppercase">
                Register your first client to get started.
              </p>
            </div>
          ) : (
            <Table className="w-full border-collapse">
              <TableHeader className="bg-muted/30 border-b border-border">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="p-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">CLIENT</TableHead>
                  <TableHead className="p-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">BRAND</TableHead>
                  <TableHead className="p-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">DATE REGISTERED</TableHead>
                  <TableHead className="p-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {clients.map((client) => (
                  <TableRow
                    key={client._id}
                    className="cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => navigate(`/clients/${client._id}`)}
                  >
                    <TableCell className="p-4 text-base font-semibold tracking-wide text-foreground">
                      {client.clientName}
                    </TableCell>
                    <TableCell className="p-4 text-sm text-foreground/80 font-medium">
                      {client.brandName}
                    </TableCell>
                    <TableCell className="p-4 font-mono text-sm text-muted-foreground">
                      {new Date(client.dateRegistered).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="p-4">
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
