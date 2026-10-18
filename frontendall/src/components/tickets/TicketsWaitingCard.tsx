import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Ticket } from 'lucide-react'
import { apiClient } from '@/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardCard, DashboardCardEmpty } from '@/components/dashboard/DashboardCard'
import { cn } from '@/lib/utils'

// "Tickets waiting on you" — the dashboard's glance at Task Management. The
// colours are the tickets' own, from the server.

interface WaitingTicket {
  _id: string
  code: string
  title: string
  color: string
  stageLabel: string
  nextStepLabel: string | null
  dueAt: string
  isOverdue: boolean
  isSentBack: boolean
  raisedBy: { name: string | null }
}

interface Summary {
  waitingCount: number
  overdueCount: number
  raisedOpen: number
  unreviewed: number
  calendarWaiting: number
  waiting: WaitingTicket[]
}

function inkOn(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#111827'
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#111827' : '#ffffff'
}

export function TicketsWaitingCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'summary'],
    queryFn: async () => (await apiClient.get<Summary>('/tickets/summary')).data,
    refetchInterval: 60_000,
  })
  const total = (data?.waitingCount ?? 0) + (data?.calendarWaiting ?? 0)

  return (
    <DashboardCard
      icon={<Ticket className="size-4" />}
      title={total ? `Tickets waiting on you (${total})` : 'Tickets waiting on you'}
      viewAllHref="/followups/tickets"
      viewAllLabel="Open tickets"
    >
      {isLoading ? (
        <div className="grid gap-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : !data || total === 0 ? (
        <DashboardCardEmpty icon={<Ticket className="size-4" />} message="Nothing is waiting on you." />
      ) : (
        <div className="grid gap-2">
          {data.waiting.map((t) => (
            <Link
              key={t._id}
              to={`/followups/tickets/${t._id}`}
              className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-secondary/30 p-3 pl-4 transition-colors hover:bg-secondary/60"
            >
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: t.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono font-bold text-foreground/70">{t.code}</span>
                  <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: t.color, color: inkOn(t.color) }}>
                    {t.isSentBack ? 'Sent back' : t.stageLabel}
                  </span>
                  {t.nextStepLabel && (
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowRight className="size-3" />
                      {t.nextStepLabel}
                    </span>
                  )}
                </p>
              </div>
              <span className={cn('shrink-0 text-xs font-bold', t.isOverdue ? 'text-slate-600' : 'text-primary')}>
                {t.isOverdue ? 'Overdue' : new Date(t.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </Link>
          ))}
          {data.waitingCount > data.waiting.length && (
            <p className="text-xs text-muted-foreground">+{data.waitingCount - data.waiting.length} more</p>
          )}
          {data.calendarWaiting > 0 && (
            <Link to="/followups/tickets" className="flex items-center gap-2 rounded-xl bg-secondary/30 p-3 text-xs font-semibold text-foreground hover:bg-secondary/60">
              <CalendarDays className="size-4 text-muted-foreground" />
              {data.calendarWaiting} from the content calendar
            </Link>
          )}
        </div>
      )}
    </DashboardCard>
  )
}
