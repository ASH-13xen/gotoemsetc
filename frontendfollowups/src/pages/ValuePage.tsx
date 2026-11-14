import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Lock, LockOpen, Loader2 } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/api/tickets.api'
import { addMonth, closeValueMonth, monthKeyOf, monthName, reopenValueMonth, rupees, setTargetMargin, type ContentType, type ValueClientRow } from '@/api/work.api'
import { useValueReport, useWorkMutation } from '@/hooks/useWork'
import { fmtDateTime } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const TYPES: ContentType[] = ['reels', 'posts', 'stories', 'festiveStories']

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-black tabular-nums', tone === 'good' && 'text-emerald-700', tone === 'bad' && 'text-red-600')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Worth({ row, target }: { row: ValueClientRow; target: number }) {
  if (row.worthIt === null) return <span className="text-[11px] text-muted-foreground">no revenue</span>
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', row.worthIt ? 'bg-emerald-500/12 text-emerald-700' : 'bg-red-500/12 text-red-600')} title={`Target margin ${target}%`}>
      {row.worthIt ? 'Worth it' : 'Below target'}
    </span>
  )
}

export default function ValuePage() {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') || monthKeyOf()
  const { data: r, isLoading, error } = useValueReport(month)
  const [target, setTarget] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const saveTarget = useWorkMutation((n: number) => setTargetMargin(n))
  const close = useWorkMutation(() => closeValueMonth(month))
  const reopen = useWorkMutation(() => reopenValueMonth(month))
  const go = (m: string) => setParams({ month: m }, { replace: true })
  const past = month < monthKeyOf()
  const margin = r ? r.totals.revenue - r.totals.costOfClientsWithRevenue : 0

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Client work</p>
            <h1 className="text-2xl font-black tracking-tight">Client value</h1>
            <p className="text-sm text-muted-foreground">What each client brings in against what their work costs — people's hours at their salary rate (salary ÷ working days × 8 h).</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => go(addMonth(month, -1))} aria-label="Month before">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-bold">{monthName(month)}</span>
            <Button size="icon" variant="outline" onClick={() => go(addMonth(month, 1))} aria-label="Month after">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl bg-secondary/50" />
        ) : !r ? (
          <p className="text-sm text-muted-foreground">{errorMessage(error, 'Only the CEO and admin see this report.')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/40 p-3 text-sm ring-1 ring-border">
              {r.closed ? (
                <>
                  <Lock className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    Closed {fmtDateTime(r.closed.at)}
                    {r.closed.by ? ` by ${r.closed.by}` : ''} — these figures are fixed.
                  </span>
                  <Button size="sm" variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutateAsync(undefined).then(() => toast.success('Reopened — figures are live again'))}>
                    <LockOpen className="size-4" />
                    Reopen
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    Live figures · {r.workingDays} working days × {r.hoursPerDay} h
                    {r.workingDaysSoFar != null && r.workingDaysSoFar < r.workingDays ? ` · paid and unlogged hours up to yesterday (${r.workingDaysSoFar} days)` : ''} · worked out {fmtDateTime(r.generatedAt)}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    Target margin
                    <Input type="number" min={0} max={95} value={target || String(r.targetMarginPct)} onChange={(e) => setTarget(e.target.value)} className="h-8 w-16 text-right" />%
                    {target && Number(target) !== r.targetMarginPct && (
                      <Button size="sm" variant="ghost" disabled={saveTarget.isPending} onClick={() => saveTarget.mutateAsync(Number(target)).then(() => (setTarget(''), toast.success('Target saved')))}>
                        Save
                      </Button>
                    )}
                  </span>
                  {past && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={close.isPending}
                      onClick={() =>
                        close
                          .mutateAsync(undefined)
                          .then(() => toast.success('Month closed — figures fixed'))
                          .catch((err) => toast.error(errorMessage(err, 'Could not close it')))
                      }
                    >
                      {close.isPending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                      Close the month
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Revenue" value={rupees(r.totals.revenue)} sub="invoices, else the fee typed in" />
              <Tile label="Client work cost" value={rupees(r.totals.clientCost)} sub={`${r.clients.reduce((t, c) => t + c.hours, 0).toFixed(1)} h on clients`} />
              <Tile label="Margin (clients with revenue)" value={rupees(margin)} tone={margin >= 0 ? 'good' : 'bad'} sub={r.totals.revenue ? `${Math.round((margin / r.totals.revenue) * 1000) / 10}% of revenue` : undefined} />
              <Tile label="Overhead" value={rupees(r.overhead.cost)} sub="other work, non-client tickets, unlogged time" />
            </div>

            <section className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="p-3">Client</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">Hours</th>
                    <th className="p-3 text-right">Cost</th>
                    <th className="p-3 text-right">Margin</th>
                    <th className="p-3">Verdict</th>
                    <th className="p-3">Done</th>
                    <th className="p-3">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {r.clients.map((c) => (
                    <Fragment key={c.client._id}>
                      <tr className="cursor-pointer border-b border-border/60 hover:bg-secondary/30" onClick={() => setOpen(open === c.client._id ? null : c.client._id)}>
                        <td className="p-3 font-bold">{c.client.name}</td>
                        <td className="p-3 text-right tabular-nums">
                          {rupees(c.revenue)}
                          {c.revenueSource && <span className="block text-[10px] text-muted-foreground">{c.revenueSource}</span>}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {c.hours}
                          {c.estimatedHours > 0 && <span className="block text-[10px] text-muted-foreground">+{c.estimatedHours} held, unlogged</span>}
                        </td>
                        <td className="p-3 text-right tabular-nums">{rupees(c.cost)}</td>
                        <td className={cn('p-3 text-right tabular-nums font-bold', c.margin != null && (c.margin >= 0 ? 'text-emerald-700' : 'text-red-600'))}>
                          {rupees(c.margin)}
                          {c.marginPct != null && <span className="block text-[10px] font-normal">{c.marginPct}%</span>}
                        </td>
                        <td className="p-3">
                          <Worth row={c} target={r.targetMarginPct} />
                        </td>
                        <td className="p-3 text-xs">
                          {TYPES.filter((k) => c.deliverables[k].committed)
                            .map((k) => `${c.deliverables[k].done}/${c.deliverables[k].committed} ${r.byType[k].label.toLowerCase()}`)
                            .join(' · ') || '—'}
                        </td>
                        <td className="p-3 text-[11px]">
                          {c.unconfirmedHours > 0 && <span className="block text-amber-700">{c.unconfirmedHours} h not confirmed</span>}
                          {c.changedHours > 0 && <span className="block text-muted-foreground">{c.changedHours} changed from the estimate</span>}
                        </td>
                      </tr>
                      {open === c.client._id && (
                        <tr className="border-b border-border/60 bg-secondary/20">
                          <td colSpan={8} className="p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cost per piece</p>
                                {TYPES.filter((k) => c.deliverables[k].committed || c.deliverables[k].cost).map((k) => (
                                  <p key={k} className="flex justify-between text-xs">
                                    <span>{r.byType[k].label}</span>
                                    <span className="tabular-nums">
                                      {rupees(c.deliverables[k].cost)} · {c.deliverables[k].costPerDone != null ? `${rupees(c.deliverables[k].costPerDone)} each` : 'none done'}
                                    </span>
                                  </p>
                                ))}
                              </div>
                              <div>
                                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Who worked on it</p>
                                {c.people.map((p) => (
                                  <p key={p._id} className="flex justify-between text-xs">
                                    <span>{p.name}</span>
                                    <span className="tabular-nums">
                                      {p.hours} h · {rupees(p.cost)}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">By kind</h2>
                {TYPES.map((k) => (
                  <p key={k} className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
                    <span>{r.byType[k].label}</span>
                    <span className="tabular-nums">
                      {r.byType[k].done} done · {r.byType[k].hours} h · {rupees(r.byType[k].cost)}
                      {r.byType[k].costPerDone != null && <span className="text-muted-foreground"> · {rupees(r.byType[k].costPerDone)} each</span>}
                    </span>
                  </p>
                ))}
                <h2 className="mb-3 mt-6 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Overhead</h2>
                {r.overhead.other.map((o) => (
                  <p key={o.label} className="flex justify-between py-1 text-sm">
                    <span>{o.label}</span>
                    <span className="tabular-nums">
                      {o.hours} h · {rupees(o.cost)}
                    </span>
                  </p>
                ))}
                <p className="flex justify-between py-1 text-sm">
                  <span>Tickets not for a client</span>
                  <span className="tabular-nums">
                    {r.overhead.nonClientTickets.hours} h · {rupees(r.overhead.nonClientTickets.cost)}
                  </span>
                </p>
                <p className="flex justify-between py-1 text-sm">
                  <span>Paid but not logged</span>
                  <span className="tabular-nums">
                    {r.overhead.unlogged.hours} h · {rupees(r.overhead.unlogged.cost)}
                  </span>
                </p>
              </section>
              <section className="overflow-x-auto rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">People</h2>
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2">Name</th>
                      <th className="pb-2 text-right">₹/h</th>
                      <th className="pb-2 text-right">Paid h</th>
                      <th className="pb-2 text-right">Logged</th>
                      <th className="pb-2 text-right">Clients</th>
                      <th className="pb-2 text-right">Overtime</th>
                      <th className="pb-2 text-right">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.people.map((p) => (
                      <tr key={p._id} className="border-t border-border/50">
                        <td className="py-1.5">
                          {p.name}
                          {p.noSalary && <span className="ml-1 text-[10px] text-amber-700">no salary set</span>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{Math.round(p.hourlyCost)}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.paidHours}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.loggedHours}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.clientHours}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.overtimeHours || ''}</td>
                        <td className={cn('py-1.5 text-right font-bold tabular-nums', (p.utilizationPct ?? 0) < 60 && 'text-amber-700')}>{p.utilizationPct != null ? `${p.utilizationPct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </main>
    </>
  )
}
