import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, CalendarDays, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { RegisterClientDialog } from '@/components/clients/RegisterClientDialog'
import { PlanBadge } from '@/components/clients/PlanBadge'

export default function ClientsPage() {
  const navigate = useNavigate()
  const { data: clients, isLoading } = useClients()
  const { canEditClient, isReadOnly } = useCmsAccess()
  const [search, setSearch] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients ?? []
    return (clients ?? []).filter(
      (c) => c.name.toLowerCase().includes(q) || (c.brandName ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every client registered in Task Management, with their plan and content calendars.
            {isReadOnly && ' You have read-only access.'}
          </p>
        </div>
        {canEditClient && (
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="mr-2 size-4" />
            Register client
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by client or brand"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No clients match that search.' : 'No clients registered yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card
              key={client._id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/clients/${client._id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/clients/${client._id}`)
                }
              }}
              className="cursor-pointer"
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start gap-3">
                  {client.logoUrl ? (
                    <img
                      src={client.logoUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold">
                      {client.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{client.name}</p>
                    {client.brandName && (
                      <p className="truncate text-xs text-muted-foreground">{client.brandName}</p>
                    )}
                  </div>
                  <PlanBadge plan={client.currentPlan} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {client.defaultTeam ? (
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <Users className="size-3" />
                      {client.defaultTeam.name}
                    </Badge>
                  ) : (
                    <span className="italic">No team assigned</span>
                  )}
                </div>

                {/* Straight to the calendar, per the ask — without having to
                    open the client first. */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clients/${client._id}?tab=calendars`)
                  }}
                >
                  <CalendarDays className="mr-2 size-4" />
                  Calendars
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegisterClientDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </div>
  )
}
