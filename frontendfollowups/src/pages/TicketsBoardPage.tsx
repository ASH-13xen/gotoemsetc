import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Ticket as TicketIcon } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { TicketStub } from '@/components/tickets/TicketStub'
import { ColorGuide } from '@/components/tickets/ColorGuide'
import { RaiseTicketDialog } from '@/components/tickets/RaiseTicketDialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCalendarTickets, useTicketMeta, useTicketSummary, useTickets } from '@/hooks/useTickets'
import { calendarLink, calendarStub, ticketStub } from '@/lib/stubData'
import type { Scope } from '@/api/tickets.api'
import { cn } from '@/lib/utils'

type Tab = Exclude<Scope, 'submitted'>
const STATUSES = [
  { key: 'open', label: 'Open' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

function Empty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center">
      <div className="relative">
        <TicketIcon className="size-10 -rotate-12 text-muted-foreground/25" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

export default function TicketsBoardPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'mine'
  const status = tab === 'mine' ? 'open' : params.get('status') || 'open'
  const [q, setQ] = useState('')
  const { data: meta } = useTicketMeta()
  const { data: summary } = useTicketSummary()
  const tickets = useTickets(tab, status, q || undefined)
  const calScope = tab === 'raised' ? null : tab === 'mine' ? 'mine' : tab === 'team' ? 'team' : 'all'
  const calendar = useCalendarTickets(calScope || 'mine', status, Boolean(calScope) && !q)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'mine', label: 'For me', count: summary ? summary.waitingCount + summary.calendarWaiting : undefined },
    { key: 'raised', label: 'Raised by me', count: summary?.raisedOpen },
    ...(meta?.me.hasTeam || meta?.me.seesEveryone ? [{ key: 'team' as Tab, label: 'My team' }] : []),
    ...(meta?.me.seesEveryone ? [{ key: 'all' as Tab, label: 'All tickets' }] : []),
  ]
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    if (k === 'tab') next.delete('status')
    setParams(next, { replace: true })
  }

  const list = tickets.data || []
  const cal = calScope ? calendar.data || [] : []
  const emptyText: Record<Tab, string> = {
    mine: "Nothing is waiting on you. When a ticket reaches your step, it lands here.",
    raised: "You haven't raised any tickets yet.",
    team: 'No tickets for the people below you right now.',
    all: 'No tickets here.',
  }

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* header */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-primary to-violet-600 p-6 text-white shadow-lg sm:p-8">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 right-24 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">Task Management</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Tickets</h1>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Raise a ticket for anyone in your box or below. It moves through its pipeline, changes colour at every step, and keeps a timestamped record of everything that happens.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { n: summary ? summary.waitingCount + summary.calendarWaiting : '–', l: 'waiting on you' },
                { n: summary?.overdueCount ?? '–', l: 'of them overdue' },
                { n: summary?.raisedOpen ?? '–', l: 'raised by you, open' },
              ].map((s) => (
                <div key={s.l} className="min-w-[110px] rounded-2xl bg-white/12 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
                  <p className="text-2xl font-black">{s.n}</p>
                  <p className="text-[11px] font-medium text-white/75">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* tabs + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-secondary/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => set('tab', t.key)}
                className={cn('inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition', tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && <span className={cn('rounded-full px-1.5 text-[10px] font-extrabold', tab === t.key ? 'bg-primary text-white' : 'bg-muted-foreground/15')}>{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== 'mine' &&
              STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => set('status', s.key)}
                  className={cn('rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', status === s.key ? 'bg-foreground text-background ring-foreground' : 'ring-border hover:bg-secondary')}
                >
                  {s.label}
                </button>
              ))}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or TKT-…" className="w-56 pl-9" />
            </div>
          </div>
        </div>

        {meta && <ColorGuide meta={meta} />}

        {/* tickets */}
        {tickets.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl bg-secondary/50" />
            ))}
          </div>
        ) : list.length === 0 && cal.length === 0 ? (
          <div className="grid gap-4">
            <Empty text={emptyText[tab]} />
            {tab === 'raised' && (
              <div className="justify-self-center">
                <RaiseTicketDialog />
              </div>
            )}
          </div>
        ) : (
          <>
            {list.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-2">
                <AnimatePresence initial={false}>
                  {list.map((t, i) => (
                    <motion.div key={t._id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                      <TicketStub d={ticketStub(t)} to={`/tickets/${t._id}`} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </section>
            )}
            {cal.length > 0 && (
              <section className="grid gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">From the content calendar</h2>
                  <p className="text-xs text-muted-foreground">Daily stories and monthly posts and reels — they come from the calendar, nobody raises them.</p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {cal.map((t) => (
                    <TicketStub key={`${t.kind}-${t._id}`} d={calendarStub(t)} to={calendarLink(t)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}
