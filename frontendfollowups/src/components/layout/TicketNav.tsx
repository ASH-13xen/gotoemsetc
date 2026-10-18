import { NavLink } from 'react-router-dom'
import { BarChart3, Inbox, Ticket } from 'lucide-react'
import { useTicketMeta, useTicketSummary } from '@/hooks/useTickets'
import { RaiseTicketDialog } from '@/components/tickets/RaiseTicketDialog'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-secondary/60 hover:text-foreground',
    isActive && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
  )

export function TicketNav() {
  const { data: meta } = useTicketMeta()
  const { data: summary } = useTicketSummary()
  const top = meta?.me.seesEveryone
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex select-none items-center gap-2 text-lg font-extrabold tracking-tight text-foreground">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-sm">
              <Ticket className="size-4" />
            </span>
            Tickets
          </span>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/tickets" end className={linkClass}>
              Board
              {summary && summary.waitingCount + summary.calendarWaiting > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">{summary.waitingCount + summary.calendarWaiting}</span>
              )}
            </NavLink>
            {top && (
              <NavLink to="/submitted" className={linkClass}>
                <Inbox className="size-3.5" />
                Submitted
                {summary && summary.unreviewed > 0 && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">{summary.unreviewed}</span>}
              </NavLink>
            )}
            {top && (
              <NavLink to="/analysis" className={linkClass}>
                <BarChart3 className="size-3.5" />
                Analysis
              </NavLink>
            )}
          </nav>
        </div>
        <RaiseTicketDialog />
      </div>
    </header>
  )
}
