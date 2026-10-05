import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Fingerprint, Hand, Hourglass, Loader2, Timer, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { useApproveOvertime, useCmApproveOvertime, useOvertimeQueue, useRejectOvertime } from '@/hooks/useOvertimeRequests'
import type { OvertimeReviewItem } from '@/api/overtimeRequests.api'
import { cn } from '@/lib/utils'

// Overtime waiting on this person. A content manager passes their team's
// overtime on to HR with a reason; HR gives the final approval, which is
// what puts it on the calendar and the salary slip. Either can change the
// minutes, and either can turn it down.

type Mode = 'contentManager' | 'hr'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
const hm = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`)
const nameOf = (r: OvertimeReviewItem) => `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim().toLowerCase()

function Figures({ request }: { request: OvertimeReviewItem }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      {request.biometricMinutes > 0 && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-muted-foreground">
          <Fingerprint className="size-3" /> Biometric <b className="text-foreground">{request.biometricMinutes} min</b>
        </span>
      )}
      {request.appliedMinutes !== null && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-muted-foreground">
          <Hand className="size-3" /> Applied for <b className="text-foreground">{request.appliedMinutes} min</b>
        </span>
      )}
      {request.cmMinutes !== null && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-primary">
          Content manager says <b>{request.cmMinutes} min</b>
        </span>
      )}
    </div>
  )
}

function Row({ request, mode }: { request: OvertimeReviewItem; mode: Mode }) {
  const [minutes, setMinutes] = useState(String(request.suggestedMinutes || ''))
  const [text, setText] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const cmApprove = useCmApproveOvertime()
  const approve = useApproveOvertime()
  const reject = useRejectOvertime()
  const busy = cmApprove.isPending || approve.isPending || reject.isPending
  const isCm = mode === 'contentManager'

  const onApprove = () => {
    const value = Number(minutes)
    if (!Number.isInteger(value) || value < 1) return toast.error('Enter the overtime in whole minutes')
    if (isCm) {
      if (!text.trim()) return toast.error('Tell HR what this overtime was for')
      return cmApprove.mutate(
        { id: request._id, minutes: value, reason: text.trim() },
        { onSuccess: () => toast.success('Sent to HR for approval'), onError: (err) => toast.error(apiMessage(err, 'Could not send it to HR')) }
      )
    }
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
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground capitalize">{nameOf(request)}</p>
          <p className="text-xs font-semibold text-primary">{fmtDate(request.date)}</p>
        </div>
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-700 tabular-nums">
          {hm(request.suggestedMinutes)}
        </span>
      </div>
      <Figures request={request} />
      {request.employeeReason && (
        <p className="mt-2 text-sm text-foreground">
          <span className="text-xs font-semibold text-muted-foreground">Employee: </span>“{request.employeeReason}”
        </p>
      )}
      {request.cmReason && (
        <div className="mt-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-2.5">
          <p className="text-[11px] font-bold tracking-wide text-primary uppercase">
            Content manager's reason{request.cmApprovedByName ? ` — ${request.cmApprovedByName.toLowerCase()}` : ''}
          </p>
          <p className="mt-0.5 text-sm text-foreground">“{request.cmReason}”</p>
        </div>
      )}

      {request.isOwn ? (
        <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">This is your own overtime — someone else has to decide it.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {!rejecting && (
            <div className="flex items-center gap-2">
              <label htmlFor={`ot-min-${request._id}`} className="text-xs font-semibold text-muted-foreground">
                Minutes to approve
              </label>
              <Input
                id={`ot-min-${request._id}`}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="h-8 w-24 text-sm"
                disabled={busy}
              />
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            disabled={busy}
            className="text-sm"
            placeholder={
              rejecting
                ? 'Why is this not approved? (the employee will see it)'
                : isCm
                  ? 'Reason for this overtime — HR will see it (required)'
                  : 'Note (optional)'
            }
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
              <Button size="sm" className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={onApprove} disabled={busy}>
                {cmApprove.isPending || approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {isCm ? 'Send to HR' : 'Approve'}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>
                <X className="size-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, hint, requests, mode }: { title: string; hint: string; requests: OvertimeReviewItem[]; mode: Mode }) {
  // HR can clear a run of straightforward ones at once, each at the minutes
  // on the table (the content manager's figure, else applied, else biometric).
  const approve = useApproveOvertime()
  const [bulkBusy, setBulkBusy] = useState(false)
  const bulkable = mode === 'hr' ? requests.filter((r) => !r.isOwn && r.suggestedMinutes > 0) : []
  const approveAll = async () => {
    setBulkBusy(true)
    let done = 0
    for (const r of bulkable) {
      try {
        await approve.mutateAsync({ id: r._id, minutes: r.suggestedMinutes })
        done += 1
      } catch (err) {
        toast.error(`${nameOf(r)} — ${fmtDate(r.date)}: ${apiMessage(err, 'could not approve')}`)
      }
    }
    setBulkBusy(false)
    if (done) toast.success(`Approved ${done} overtime request${done === 1 ? '' : 's'}`)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-amber-500/[0.07] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
          <Timer className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {bulkable.length > 1 && (
          <Button size="sm" variant="outline" onClick={approveAll} disabled={bulkBusy}>
            {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Approve all {bulkable.length} as shown
          </Button>
        )}
        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-white">{requests.length}</span>
      </div>
      <div className={cn('grid max-h-[34rem] gap-3 overflow-y-auto p-4', requests.length > 1 && 'md:grid-cols-2')}>
        {requests.map((r) => (
          <Row key={r._id} request={r} mode={mode} />
        ))}
      </div>
    </div>
  )
}

export function OvertimeApprovalsCard() {
  const { user } = useAuth()
  const { data } = useOvertimeQueue(Boolean(user))
  if (!data) return null
  const waitingOnCm = data.withContentManager.length

  if (data.contentManager.length === 0 && data.hr.length === 0 && waitingOnCm === 0) return null

  return (
    <div className="dashboard-card grid gap-4">
      {data.contentManager.length > 0 && (
        <Section
          mode="contentManager"
          title="Overtime to review — your team"
          hint="Check the minutes, say what the overtime was for, and send it to HR. Nothing counts until HR approves."
          requests={data.contentManager}
        />
      )}
      {data.hr.length > 0 && (
        <Section
          mode="hr"
          title="Overtime waiting for HR approval"
          hint="Approving adds the minutes to attendance — and so to the calendar and the salary slip."
          requests={data.hr}
        />
      )}
      {data.isHr && waitingOnCm > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <Hourglass className="size-4 text-amber-600" />
          <span>
            <b className="text-foreground">{waitingOnCm}</b> more overtime request{waitingOnCm === 1 ? ' is' : 's are'} still with a content manager:
          </span>
          {data.withContentManager.slice(0, 8).map((r) => (
            <span key={r._id} className="rounded-full bg-secondary px-2 py-0.5 capitalize">
              {nameOf(r)} · {fmtDate(r.date)} · {r.suggestedMinutes}m
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
