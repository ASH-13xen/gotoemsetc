import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Fingerprint, Hand, Hourglass, Inbox, Loader2, Search, Timer, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useApproveOvertime, useOvertimeRequests, useRejectOvertime } from '@/hooks/useOvertimeRequests'
import type { OvertimeRequestItem } from '@/api/overtimeRequests.api'

// HR Work → Overtime requests. Overtime goes to the person's content manager
// first (when they have one who can act), then to HR — only HR's approval
// puts the minutes on attendance, the calendar and the salary slip. A
// content manager's rejection ends it there; it never comes to HR.

type Tab = 'hr' | 'cm' | 'approved' | 'rejected'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'hr', label: 'Waiting for HR', hint: 'Passed on by a content manager, or from someone with no content manager. Approving adds the minutes to attendance.' },
  { key: 'cm', label: 'With content managers', hint: 'Not with HR yet — their content manager approves or rejects first. Shown here so nothing is out of sight.' },
  { key: 'approved', label: 'Approved', hint: 'Approved overtime for the month — it is on attendance and the salary slip.' },
  { key: 'rejected', label: 'Rejected', hint: 'Turned down by the content manager or HR, with the reason the employee was given.' },
]

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const hm = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`)
const nameOf = (r: OvertimeRequestItem) => `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim().toLowerCase()
const apiMessage = (err: unknown, fallback: string) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function OvertimeRequestsPage() {
  const now = new Date()
  const [tab, setTab] = useState<Tab>('hr')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [query, setQuery] = useState('')
  const decided = tab === 'approved' || tab === 'rejected'

  const pending = useOvertimeRequests({ status: 'pending' })
  const history = useOvertimeRequests({ status: tab === 'rejected' ? 'rejected' : 'approved', month, year })
  const all = pending.data ?? []
  const lists: Record<Tab, OvertimeRequestItem[]> = {
    hr: all.filter((r) => r.stage === 'hr'),
    cm: all.filter((r) => r.stage === 'content_manager'),
    approved: tab === 'approved' ? (history.data ?? []) : [],
    rejected: tab === 'rejected' ? (history.data ?? []) : [],
  }
  const q = query.trim().toLowerCase()
  const shown = lists[tab].filter((r) => !q || nameOf(r).includes(q))
  const loading = decided ? history.isLoading : pending.isLoading
  const meta = TABS.find((t) => t.key === tab)!

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 py-8">
      <PageHeader
        eyebrow="HRMS"
        title="Overtime requests"
        description="Overtime from the scans or applied for — content manager first, then HR. Only HR's approval counts it."
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const count = t.key === 'hr' ? lists.hr.length : t.key === 'cm' ? lists.cm.length : null
          return (
            <Button key={t.key} type="button" size="sm" variant={tab === t.key ? 'default' : 'outline'} onClick={() => setTab(t.key)}>
              {t.label}
              {count !== null && count > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-white">{count}</span>}
            </Button>
          )
        })}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a person…" className="h-9 w-56 pl-8" aria-label="Search a person" />
        </div>
        {decided && (
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              aria-label="Month"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2 text-sm" aria-label="Year">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Card className="p-5">
        <CardContent className="grid gap-4 p-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
              {tab === 'cm' ? <Hourglass className="size-4" /> : <Timer className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {meta.label} <Badge variant="outline">{shown.length}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">{meta.hint}</p>
            </div>
            {tab === 'hr' && <ApproveAll requests={shown} />}
          </div>

          {loading ? (
            <Skeleton className="h-24 w-full rounded-xl bg-secondary/40" />
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nothing here.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((r) => (
                <OvertimeCard key={r._id} request={r} actionable={tab === 'hr'} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Clear a run of straightforward ones at once, each at the minutes on the
// table (the content manager's figure, else applied, else biometric).
function ApproveAll({ requests }: { requests: OvertimeRequestItem[] }) {
  const approve = useApproveOvertime()
  const [busy, setBusy] = useState(false)
  const bulkable = useMemo(() => requests.filter((r) => !r.isOwn && r.suggestedMinutes > 0), [requests])
  if (bulkable.length < 2) return null
  const run = async () => {
    setBusy(true)
    let done = 0
    for (const r of bulkable) {
      try {
        await approve.mutateAsync({ id: r._id, minutes: r.suggestedMinutes })
        done += 1
      } catch (err) {
        toast.error(`${nameOf(r)} — ${fmtDate(r.date)}: ${apiMessage(err, 'could not approve')}`)
      }
    }
    setBusy(false)
    if (done) toast.success(`Approved ${done} overtime request${done === 1 ? '' : 's'}`)
  }
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      Approve all {bulkable.length} as shown
    </Button>
  )
}

function OvertimeCard({ request, actionable }: { request: OvertimeRequestItem; actionable: boolean }) {
  const approve = useApproveOvertime()
  const reject = useRejectOvertime()
  const [minutes, setMinutes] = useState(String(request.suggestedMinutes || ''))
  const [text, setText] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const busy = approve.isPending || reject.isPending

  const onApprove = () => {
    const value = Number(minutes)
    if (!Number.isInteger(value) || value < 1) return toast.error('Enter the overtime in whole minutes')
    approve.mutate(
      { id: request._id, minutes: value, note: text.trim() || undefined },
      { onSuccess: () => toast.success(`Approved — ${value} min added to attendance`), onError: (err) => toast.error(apiMessage(err, 'Could not approve')) }
    )
  }
  const onReject = () => {
    if (!text.trim()) return toast.error('Give a reason for turning it down')
    reject.mutate(
      { id: request._id, reason: text.trim() },
      { onSuccess: () => toast.success('Not approved — the employee has been told'), onError: (err) => toast.error(apiMessage(err, 'Could not reject')) }
    )
  }

  return (
    <div className="grid content-start gap-2 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground capitalize">{nameOf(request)}</p>
          <p className="text-xs font-semibold text-primary">{fmtDate(request.date)}</p>
        </div>
        {request.status === 'approved' ? (
          <Badge variant="success">{hm(request.approvedMinutes ?? 0)} approved</Badge>
        ) : request.status === 'rejected' ? (
          <Badge variant="destructive">Rejected by {request.rejectedStage === 'content_manager' ? 'content manager' : 'HR'}</Badge>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-700 tabular-nums">{hm(request.suggestedMinutes)}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {request.biometricMinutes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-muted-foreground">
            <Fingerprint className="size-3" /> Biometric <b className="text-foreground">{request.biometricMinutes} min</b>
          </span>
        )}
        {request.appliedMinutes !== null && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-muted-foreground">
            <Hand className="size-3" /> Applied <b className="text-foreground">{request.appliedMinutes} min</b>
          </span>
        )}
        {request.cmMinutes !== null && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-primary">
            Content manager <b>{request.cmMinutes} min</b>
          </span>
        )}
      </div>
      {request.employeeReason && (
        <p className="text-sm text-foreground">
          <span className="text-xs font-semibold text-muted-foreground">Employee: </span>“{request.employeeReason}”
        </p>
      )}
      {request.cmReason && (
        <p className="rounded-xl border border-primary/25 bg-primary/5 p-2 text-sm text-foreground">
          <span className="block text-[11px] font-bold tracking-wide text-primary uppercase">
            Content manager{request.cmApprovedByName ? ` — ${request.cmApprovedByName.toLowerCase()}` : ''}
          </span>
          “{request.cmReason}”
        </p>
      )}
      {request.status === 'rejected' && request.rejectionReason && (
        <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Reason: {request.rejectionReason}</p>
      )}
      {request.status !== 'pending' && request.decidedByInfo && (
        <p className="text-[11px] text-muted-foreground">
          Decided by {request.decidedByInfo.name}
          {request.decidedByInfo.asLabel ? ` (${request.decidedByInfo.asLabel})` : ''}
          {request.decidedAt ? ` · ${new Date(request.decidedAt).toLocaleDateString('en-IN')}` : ''}
        </p>
      )}
      {request.status === 'pending' && request.stage === 'content_manager' && (
        <p className="text-[11px] text-muted-foreground">Waiting for their content manager — HR can act once it's passed on.</p>
      )}

      {actionable &&
        (request.isOwn ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">This is your own overtime — someone else has to decide it.</p>
        ) : (
          <div className="mt-1 grid gap-2">
            {!rejecting && (
              <div className="flex items-center gap-2">
                <label htmlFor={`ot-${request._id}`} className="text-xs font-semibold text-muted-foreground">
                  Minutes to approve
                </label>
                <Input id={`ot-${request._id}`} type="number" min={1} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8 w-24" disabled={busy} />
              </div>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              disabled={busy}
              placeholder={rejecting ? 'Why is this not approved? (the employee will see it)' : 'Note (optional)'}
            />
            {rejecting ? (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
                  Back
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} disabled={busy}>
                  {reject.isPending && <Loader2 className="size-3.5 animate-spin" />} Reject overtime
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className={cn('flex-1 bg-emerald-600 text-white hover:bg-emerald-700')} onClick={onApprove} disabled={busy}>
                  {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
