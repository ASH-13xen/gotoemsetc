import { useState } from 'react'
import { toast } from 'sonner'
import { Check, FileSignature, FileText, Loader2, Undo2, UserMinus } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import {
  approveFnf,
  confirmFnfLastDay,
  fetchFnfDocument,
  fetchFnfSlip,
  listFnfForApproval,
  listFnfForHr,
  sendBackFnf,
  type FnfSettlement,
} from '@/api/fnf.api'
import { AckButton, useAckScope } from '@/components/layout/ActionAck'
import { ACTION_KEY } from '@/lib/actionKeys'

// Full & final settlement on the dashboard. HR confirms the last working day
// (which makes the final salary slip); the CEO/admin then approves the
// settlement and that slip together, which mails Finance and puts it in
// Finance → FnF. Each card shows nothing when there is nothing to do.

const KEY = ['fnf-settlements']
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const nameOf = (s: FnfSettlement) => `${s.employee.firstName} ${s.employee.lastName ?? ''}`.trim().toLowerCase()
const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function openBlob(load: () => Promise<Blob>, failed: string) {
  try {
    const url = URL.createObjectURL(await load())
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    toast.error(failed)
  }
}

function Shell({ title, hint, count, icon, tone, children }: { title: string; hint: string; count: number; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <div className={`dashboard-card overflow-hidden rounded-2xl border bg-card ${tone}`}>
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-black text-white">{count}</span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">{children}</div>
    </div>
  )
}

function DocButton({ settlement }: { settlement: FnfSettlement }) {
  return (
    <Button size="sm" variant="outline" onClick={() => openBlob(() => fetchFnfDocument(settlement._id), 'Could not open the settlement document')}>
      <FileSignature className="size-3.5" /> Settlement document
    </Button>
  )
}

function HrRow({ settlement }: { settlement: FnfSettlement }) {
  const queryClient = useQueryClient()
  const [day, setDay] = useState((settlement.suggestedLastDay ?? '').slice(0, 10))
  const confirm = useMutation({ mutationFn: () => confirmFnfLastDay(settlement._id, day) })
  const future = Boolean(day) && day > todayKey()

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background p-4">
      <p className="truncate text-sm font-bold text-foreground capitalize">{nameOf(settlement)}</p>
      <p className="text-xs text-muted-foreground">
        {[settlement.employee.employeeCode, settlement.employee.designation].filter(Boolean).join(' · ')} · Severance {rupees(settlement.severance)}
      </p>
      {settlement.sendBackNote && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">Sent back: {settlement.sendBackNote}</p>
      )}
      <div className="mt-3 grid gap-1.5">
        <label htmlFor={`fnf-day-${settlement._id}`} className="text-xs font-semibold text-muted-foreground">
          Last working day
        </label>
        <Input id={`fnf-day-${settlement._id}`} type="date" value={day} max={todayKey()} onChange={(e) => setDay(e.target.value)} className="h-9" />
        <p className="text-[11px] text-muted-foreground">
          {settlement.suggestedLastDay ? 'Filled in from their record or the settlement document — change it if it is different. ' : ''}
          The final salary slip is made up to this day.
        </p>
        {future && <p className="text-[11px] font-semibold text-amber-700">This day has not come yet — confirm it once it has passed.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <DocButton settlement={settlement} />
        <AckButton keys={[ACTION_KEY.fnfHr(settlement._id)]} />
        <Button
          size="sm"
          className="flex-1"
          disabled={!day || future || confirm.isPending}
          onClick={() =>
            confirm.mutate(undefined, {
              onSuccess: () => {
                toast.success('Final salary slip made — sent to the CEO for approval')
                queryClient.invalidateQueries({ queryKey: KEY })
              },
              onError: (err) => toast.error(apiMessage(err, 'Could not confirm the last day')),
            })
          }
        >
          {confirm.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {confirm.isPending ? 'Making the final slip…' : 'Confirm & make final slip'}
        </Button>
      </div>
    </div>
  )
}

function ApprovalRow({ settlement }: { settlement: FnfSettlement }) {
  const queryClient = useQueryClient()
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY })
  const approve = useMutation({ mutationFn: () => approveFnf(settlement._id), onSuccess: refresh })
  const sendBack = useMutation({ mutationFn: () => sendBackFnf(settlement._id, note.trim()), onSuccess: refresh })
  const busy = approve.isPending || sendBack.isPending

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground capitalize">{nameOf(settlement)}</p>
          <p className="text-xs text-muted-foreground">Last working day {settlement.lastWorkingDay ? fmt(settlement.lastWorkingDay) : '—'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-sm font-black text-rose-700 tabular-nums">{rupees(settlement.total)}</span>
      </div>
      <div className="mt-2 grid gap-0.5 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">
            Final salary{settlement.salarySlip ? ` (${fmt(settlement.salarySlip.startDate)} – ${fmt(settlement.salarySlip.endDate)})` : ''}
          </span>
          <span className="tabular-nums text-foreground">{rupees(settlement.finalSalary)}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">Severance (settlement document)</span>
          <span className="tabular-nums text-foreground">{rupees(settlement.severance)}</span>
        </p>
      </div>
      {settlement.isOwn ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">This is your own settlement — someone else has to approve it.</p>
          <AckButton keys={[ACTION_KEY.fnfApproval(settlement._id)]} />
        </div>
      ) : sendingBack ? (
        <div className="mt-3 grid gap-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What needs changing? (HR will see this)" className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSendingBack(false)} disabled={busy}>
              Back
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !note.trim()}
              onClick={() =>
                sendBack.mutate(undefined, {
                  onSuccess: () => toast.success('Sent back to HR'),
                  onError: (err) => toast.error(apiMessage(err, 'Could not send it back')),
                })
              }
            >
              Send back to HR
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <DocButton settlement={settlement} />
          <Button size="sm" variant="outline" onClick={() => openBlob(() => fetchFnfSlip(settlement._id), 'Could not open the final salary slip')}>
            <FileText className="size-3.5" /> Final salary slip
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() =>
              approve.mutate(undefined, {
                onSuccess: () => toast.success('Approved — Finance has been mailed the settlement and the final slip'),
                onError: (err) => toast.error(apiMessage(err, 'Could not approve')),
              })
            }
          >
            {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSendingBack(true)} disabled={busy}>
            <Undo2 className="size-3.5" /> Send back
          </Button>
          <AckButton keys={[ACTION_KEY.fnfApproval(settlement._id)]} />
        </div>
      )}
    </div>
  )
}

export function FnfCards() {
  const { user } = useAuth()
  const isHr = can(user, 'hrms')
  const isApprover = can(user, 'payout_approval')
  const { data: allForHr = [] } = useQuery({ queryKey: [...KEY, 'hr'], queryFn: listFnfForHr, enabled: isHr, refetchInterval: 60_000 })
  const { data: allForApproval = [] } = useQuery({ queryKey: [...KEY, 'approvals'], queryFn: listFnfForApproval, enabled: isApprover, refetchInterval: 60_000 })
  const { shows } = useAckScope()
  const forHr = allForHr.filter((s) => shows(ACTION_KEY.fnfHr(s._id)))
  const forApproval = allForApproval.filter((s) => shows(ACTION_KEY.fnfApproval(s._id)))

  return (
    <>
      {isHr && forHr.length > 0 && (
        <Shell
          title="Full & final — confirm the last working day"
          hint="A settlement document was generated. Confirm the last working day to make the final salary slip; it then goes to the CEO."
          count={forHr.length}
          icon={<UserMinus className="size-4" />}
          tone="border-rose-500/30"
        >
          {forHr.map((s) => (
            <HrRow key={s._id} settlement={s} />
          ))}
        </Shell>
      )}
      {isApprover && forApproval.length > 0 && (
        <Shell
          title="Full & final settlements waiting for your approval"
          hint="Approving approves the final salary slip with it, mails Finance the settlement and the slip, and puts it in Finance → FnF."
          count={forApproval.length}
          icon={<FileSignature className="size-4" />}
          tone="border-rose-500/30"
        >
          {forApproval.map((s) => (
            <ApprovalRow key={s._id} settlement={s} />
          ))}
        </Shell>
      )}
    </>
  )
}
