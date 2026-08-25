import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useCalendarView, useCloseMonth } from '@/hooks/useCms'
import { useCmsAccess } from '@/hooks/useCmsAccess'
import { PlanBadge } from '@/components/clients/PlanBadge'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CountersPanel } from '@/components/calendar/CountersPanel'
import { DayModal } from '@/components/calendar/DayModal'
import { ReportPanel } from '@/components/calendar/ReportPanel'
import { MONTH_NAMES } from '@/lib/istDate'

export default function CalendarPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: view, isLoading } = useCalendarView(id)
  const { canManageCalendar } = useCmsAccess()
  const closeMonth = useCloseMonth(id as string)

  const [openDay, setOpenDay] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

  if (isLoading || !view) {
    return (
      <div className="space-y-4 p-6 md:p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[28rem] rounded-2xl" />
      </div>
    )
  }

  const { calendar } = view
  const isClosed = Boolean(calendar.closedAt)

  return (
    <div className="space-y-6 p-6 md:p-8">
      <button
        onClick={() => navigate(`/clients/${calendar.client._id}`)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {calendar.client.name}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {MONTH_NAMES[calendar.month - 1]} {calendar.year}
          </h1>
          <PlanBadge plan={calendar.plan} />
          {isClosed && (
            <Badge variant="outline" className="gap-1 font-normal">
              <Lock className="size-3" />
              Closed
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowReport((v) => !v)}>
            {showReport ? 'Hide report' : 'Month-end report'}
          </Button>
          {canManageCalendar && !isClosed && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => closeMonth.mutate()}
              disabled={closeMonth.isPending}
            >
              Close month
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Team: <span className="font-medium text-foreground">{calendar.team?.name}</span>
        {(() => {
          const smms = (calendar.team?.memberRoles ?? []).filter((r) => r.roles.includes('social_media_manager'))
          if (smms.length === 0) return null
          return (
            <>
              {' · '}Social media manager{smms.length > 1 ? 's' : ''}:{' '}
              <span className="font-medium text-foreground">
                {smms.map((r) => `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim()).join(', ')}
              </span>
            </>
          )
        })()}
      </p>

      {showReport && <ReportPanel calendarId={calendar._id} />}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <CalendarGrid view={view} onSelectDay={setOpenDay} />
        <CountersPanel view={view} />
      </div>

      <DayModal
        view={view}
        dateKey={openDay}
        onClose={() => setOpenDay(null)}
      />
    </div>
  )
}
