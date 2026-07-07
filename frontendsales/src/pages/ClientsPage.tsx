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
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-6xl space-y-8">
        {/* HERO HEADER */}
        <div className="grid grid-cols-1 border-2 border-white bg-black md:grid-cols-3">
          <div className="flex min-h-[180px] flex-col justify-between border-b-2 border-white p-8 md:col-span-2 md:border-r-2 md:border-b-0">
            <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">
              SALES PIPELINE
            </span>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase select-none md:text-7xl">
              CLIENTS
            </h1>
          </div>
          <div className="grid grid-cols-1 divide-y-2 divide-white">
            <RegisterClientDialog
              trigger={
                <div className="flex min-h-[120px] cursor-pointer flex-col justify-between bg-emerald-600 p-8 text-white transition-all hover:opacity-90 active:scale-[0.99]">
                  <span className="text-xs font-black uppercase tracking-widest opacity-80">NEW LEAD</span>
                  <span className="text-3xl font-extrabold tracking-wide uppercase">REGISTER CLIENT</span>
                </div>
              }
            />
            <div
              onClick={() => navigate('/quotation-templates')}
              className="flex min-h-20 cursor-pointer flex-col justify-center gap-1 bg-neutral-900 p-6 transition-all hover:bg-neutral-800 active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-white uppercase">
                <FileCog className="size-4" />
                Quotation Templates
              </span>
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 gap-4 border-2 border-white bg-black p-6 md:grid-cols-3">
          <div className="relative flex items-center md:col-span-2">
            <Search className="pointer-events-none absolute left-4 z-10 size-5 text-neutral-400" />
            <Input
              placeholder="SEARCH BY CLIENT OR BRAND NAME..."
              className="h-14 rounded-none border-2 border-white bg-black pl-12 text-lg font-bold text-white uppercase placeholder:text-neutral-500 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus | 'all')}>
            <SelectTrigger className="h-14 rounded-none border-2 border-white bg-black text-lg font-bold text-white uppercase focus:border-primary">
              <SelectValue placeholder="FILTER BY STATUS" />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-white bg-black text-white">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="lead">LEAD</SelectItem>
              <SelectItem value="onboarded">ONBOARDED</SelectItem>
              <SelectItem value="offboarded">OFFBOARDED</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CLIENTS TABLE */}
        <div className="overflow-x-auto border-2 border-white bg-black">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-neutral-800" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Users2 className="size-16 text-neutral-600" />
              <p className="text-2xl font-black tracking-wider text-white uppercase">No clients yet</p>
              <p className="text-sm tracking-widest text-neutral-400 uppercase">
                Register your first client to get started.
              </p>
            </div>
          ) : (
            <Table className="w-full border-collapse">
              <TableHeader className="border-b-2 border-white bg-neutral-900">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="p-4 text-xs font-black tracking-widest text-white uppercase">CLIENT</TableHead>
                  <TableHead className="p-4 text-xs font-black tracking-widest text-white uppercase">BRAND</TableHead>
                  <TableHead className="p-4 text-xs font-black tracking-widest text-white uppercase">DATE REGISTERED</TableHead>
                  <TableHead className="p-4 text-xs font-black tracking-widest text-white uppercase">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y-2 divide-neutral-900">
                {clients.map((client) => (
                  <TableRow
                    key={client._id}
                    className="cursor-pointer border-none transition-colors hover:bg-neutral-900"
                    onClick={() => navigate(`/clients/${client._id}`)}
                  >
                    <TableCell className="p-4 text-base font-black tracking-wider text-white uppercase">
                      {client.clientName}
                    </TableCell>
                    <TableCell className="p-4 text-sm font-bold text-neutral-300 uppercase">
                      {client.brandName}
                    </TableCell>
                    <TableCell className="p-4 font-mono text-sm font-bold text-neutral-400">
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
