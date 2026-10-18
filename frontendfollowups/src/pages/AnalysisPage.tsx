import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { BarChart3, Download } from 'lucide-react'
import { TicketNav } from '@/components/layout/TicketNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Analysis } from '@/api/tickets.api'
import { useAnalysis, useTicketMeta } from '@/hooks/useTickets'
import { fmtDate, fmtDateTime, fmtDuration } from '@/lib/ticketFormat'

const ALL = '__all__'

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Every ticket as a spreadsheet row, with one column per step it spent time at.
function exportCsv(data: Analysis) {
  const stepCols = [...new Set(data.rows.flatMap((r) => r.stepTimes.map((s) => `${r.pipeline} · ${s.label}`)))]
  const header = ['Ticket', 'Title', 'Pipeline', 'Team', 'Client', 'Priority', 'Raised by', 'For', 'Status', 'Current step', 'Raised', 'Due', 'Completed', 'Rejected', 'On time', 'Went overdue', 'Total hours', 'Times sent back', 'Record entries', 'CEO reviewed', ...stepCols.map((c) => `Hours at ${c}`)]
  const lines = data.rows.map((r) => {
    const byCol = new Map(r.stepTimes.map((s) => [`${r.pipeline} · ${s.label}`, (s.ms / 3_600_000).toFixed(2)]))
    return [
      r.code, r.title, r.pipeline, r.team, r.clientName, r.priority, r.raisedBy, r.raisedFor, r.status, r.stageLabel,
      fmtDateTime(r.createdAt), fmtDateTime(r.dueAt), r.completedAt ? fmtDateTime(r.completedAt) : '', r.rejectedAt ? fmtDateTime(r.rejectedAt) : '',
      r.onTime === null ? '' : r.onTime ? 'Yes' : 'No', r.wentOverdue ? 'Yes' : 'No', (r.totalMs / 3_600_000).toFixed(2), r.reverts, r.events, r.ceoReviewed ? 'Yes' : 'No',
      ...stepCols.map((c) => byCol.get(c) || ''),
    ].map(csvCell).join(',')
  })
  const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalysisPage() {
  const { data: meta } = useTicketMeta()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pipeline, setPipeline] = useState(ALL)
  const [team, setTeam] = useState(ALL)
  const [person, setPerson] = useState(ALL)
  const params = useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      pipeline: pipeline === ALL ? undefined : pipeline,
      team: team === ALL ? undefined : team,
      person: person === ALL ? undefined : person,
    }),
    [from, to, pipeline, team, person]
  )
  const { data, isLoading } = useAnalysis(params, Boolean(meta?.me.seesEveryone))
  if (meta && !meta.me.seesEveryone) return <Navigate to="/tickets" replace />
  const t = data?.totals
  const onTimePct = t && t.onTime + t.late ? Math.round((t.onTime / (t.onTime + t.late)) * 100) : null
  const maxStep = Math.max(1, ...(data?.steps.map((s) => s.avgMs) || [1]))

  return (
    <>
      <TicketNav />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">CEO</p>
            <h1 className="mt-1 inline-flex items-center gap-3 text-3xl font-black tracking-tight">
              <BarChart3 className="size-7 text-primary" />
              Ticket analysis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Built from every ticket's permanent record.</p>
          </div>
          <Button variant="outline" disabled={!data?.rows.length} onClick={() => data && exportCsv(data)}>
            <Download className="size-4" />
            Export to spreadsheet
          </Button>
        </div>

        <div className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {[
            { label: 'Pipeline', value: pipeline, set: setPipeline, options: meta?.pipelines.map((p) => ({ v: p.key, l: p.name })) || [] },
            { label: 'Team', value: team, set: setTeam, options: meta?.teams.map((x) => ({ v: x._id, l: x.title })) || [] },
            { label: 'Person', value: person, set: setPerson, options: meta?.raisable.map((p) => ({ v: p._id, l: p.name })) || [] },
          ].map((f) => (
            <label key={f.label} className="grid gap-1 text-xs font-semibold text-muted-foreground">
              {f.label}
              <Select value={f.value} onValueChange={f.set}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ))}
        </div>

        {isLoading || !data ? (
          <Skeleton className="h-64 rounded-2xl bg-secondary/50" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ['Tickets', t!.tickets],
                ['Open', t!.open],
                ['Completed', t!.completed],
                ['Rejected', t!.rejected],
                ['On time', onTimePct === null ? '—' : `${onTimePct}%`],
                ['Avg. turnaround', fmtDuration(t!.avgTurnaroundMs)],
              ].map(([l, n]) => (
                <div key={l as string} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                  <p className="text-2xl font-black">{n}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Average time at each step</h2>
                {data.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets yet.</p>
                ) : (
                  <div className="grid gap-2.5">
                    {data.steps.map((s) => (
                      <div key={`${s.pipeline}-${s.step}`} className="grid grid-cols-[150px_1fr_70px] items-center gap-2 text-xs">
                        <span className="truncate" title={`${s.pipeline} · ${s.step}`}>
                          <span className="text-muted-foreground">{s.pipeline} · </span>
                          <span className="font-semibold">{s.step}</span>
                        </span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (s.avgMs / maxStep) * 100)}%`, background: s.color || '#94a3b8' }} />
                        </span>
                        <span className="text-right font-mono text-[11px] text-muted-foreground">{fmtDuration(s.avgMs)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">People</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Steps done</TableHead>
                        <TableHead className="text-right">On time</TableHead>
                        <TableHead className="text-right">Late</TableHead>
                        <TableHead className="text-right">Work sent back</TableHead>
                        <TableHead className="text-right">Sent back others'</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.people.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.steps}</TableCell>
                          <TableCell className="text-right">{p.onTime}</TableCell>
                          <TableCell className="text-right">{p.late}</TableCell>
                          <TableCell className="text-right">{p.workSentBack}</TableCell>
                          <TableCell className="text-right">{p.sentBackOthers}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>

            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <h2 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Every ticket</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Raised</TableHead>
                      <TableHead className="text-right">Took</TableHead>
                      <TableHead className="text-right">Reverts</TableHead>
                      <TableHead>Slowest step</TableHead>
                      <TableHead>On time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell>
                          <Link to={`/tickets/${r._id}`} className="inline-flex items-center gap-2 font-mono text-xs font-bold hover:underline">
                            <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                            {r.code}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{r.title}</TableCell>
                        <TableCell>{r.raisedFor}</TableCell>
                        <TableCell className="text-xs">{r.status === 'rejected' ? 'Rejected' : r.stageLabel}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.createdAt)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtDuration(r.totalMs)}</TableCell>
                        <TableCell className="text-right">{r.reverts}</TableCell>
                        <TableCell className="text-xs">{r.slowestStep ? `${r.slowestStep.label} (${fmtDuration(r.slowestStep.ms)})` : '—'}</TableCell>
                        <TableCell className="text-xs">{r.onTime === null ? '—' : r.onTime ? 'Yes' : 'Late'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  )
}
