import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Download, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCalendars, useClient } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { PlanBadge } from '@/components/clients/PlanBadge'
import { ClientBasicsCard } from '@/components/clients/ClientBasicsCard'
import { ClientContactsCard } from '@/components/clients/ClientContactsCard'
import { ClientPlanCard } from '@/components/clients/ClientPlanCard'
import { ClientManualProfileCard } from '@/components/clients/ClientManualProfileCard'
import { ImportantDatesCard } from '@/components/clients/ImportantDatesCard'
import { MeetingsPanel } from '@/components/meetings/MeetingsPanel'
import { CreateCalendarDialog } from '@/components/calendar/CreateCalendarDialog'
import { MONTH_NAMES } from '@/lib/istDate'
import { apiClient } from '@/api/client'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: client, isLoading } = useClient(id)
  const { data: calendars } = useCalendars(id)
  const { canManageCalendar, isReadOnly } = useCmsAccess()
  const [createOpen, setCreateOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (isLoading || !client) {
    return (
      <div className="space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const defaultTab = searchParams.get('tab') === 'calendars' ? 'calendars' : 'overview'

  // Downloadable by anybody who can already see this client — same audience
  // as the rest of Client Management, no extra gate.
  async function downloadManual() {
    setDownloading(true)
    try {
      const { data } = await apiClient.get(`/task-clients/${id}/manual`, { responseType: 'blob' })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${client!.brandName || client!.name} — Client Manual.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All clients
      </button>

      <div className="flex flex-wrap items-center gap-4">
        {client.logoUrl ? (
          <img src={client.logoUrl} alt="" className="size-14 rounded-2xl object-cover" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-lg font-semibold">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          {client.brandName && <p className="text-sm text-muted-foreground">{client.brandName}</p>}
        </div>
        <PlanBadge plan={client.currentPlan} />
        <Button variant="outline" onClick={downloadManual} disabled={downloading}>
          <Download className="mr-2 size-4" />
          {downloading ? 'Preparing…' : 'Download manual'}
        </Button>
      </div>

      {isReadOnly && (
        <p className="rounded-xl bg-secondary/60 px-4 py-2 text-xs text-muted-foreground">
          You have read-only access to Client Management.
        </p>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendars">Calendars</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <ClientBasicsCard client={client} />
            <ClientContactsCard client={client} />
            <ClientPlanCard client={client} />
          </div>
        </TabsContent>

        <TabsContent value="calendars">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 pt-6">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                Content calendars
              </CardTitle>
              {canManageCalendar && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  New month
                </Button>
              )}
            </CardHeader>
            <CardContent className="pb-6">
              {!calendars || calendars.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No calendars yet. A month with no calendar means no content is owed —
                  including no daily stories.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {calendars.map((cal) => (
                    <button
                      key={cal._id}
                      onClick={() => navigate(`/calendars/${cal._id}`)}
                      className="rounded-xl border border-border/40 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {MONTH_NAMES[cal.month - 1]} {cal.year}
                        </span>
                        <PlanBadge plan={cal.plan} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{cal.team?.name}</p>
                      {cal.closedAt && (
                        <Badge variant="outline" className="mt-2 font-normal">
                          Closed
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <div className="grid gap-6 lg:grid-cols-2">
            <ClientManualProfileCard client={client} />
            <ImportantDatesCard clientId={client._id} />
          </div>
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingsPanel client={client} />
        </TabsContent>
      </Tabs>

      <CreateCalendarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        client={client}
        existing={calendars ?? []}
      />
    </div>
  )
}
