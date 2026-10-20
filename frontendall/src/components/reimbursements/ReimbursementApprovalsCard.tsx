import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Paperclip, Receipt, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import { useCeoApproveReimbursement, useCeoRejectReimbursement, useReimbursementsAwaitingCeo } from '@/hooks/useReimbursements'
import { CATEGORY_LABEL, fetchReimbursementReceipt, type ReimbursementForApproval } from '@/api/reimbursements.api'
import { cn } from '@/lib/utils'
import { AckButton, useAckScope } from '@/components/layout/ActionAck'
import { ACTION_KEY } from '@/lib/actionKeys'

// Reimbursement claims Finance has approved, waiting for the CEO's or
// admin's final approval. Only after it is a claim payable — on the Monday
// after the expense's Monday-to-Sunday week.

const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
const nameOf = (r: ReimbursementForApproval) => `${r.employee.firstName} ${r.employee.lastName ?? ''}`.trim().toLowerCase()
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

function Row({ claim }: { claim: ReimbursementForApproval }) {
  const approve = useCeoApproveReimbursement()
  const reject = useCeoRejectReimbursement()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [openingReceipt, setOpeningReceipt] = useState(false)
  const busy = approve.isPending || reject.isPending

  const openReceipt = async () => {
    setOpeningReceipt(true)
    try {
      const url = URL.createObjectURL(await fetchReimbursementReceipt(claim._id))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Could not open the receipt')
    } finally {
      setOpeningReceipt(false)
    }
  }

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground capitalize">{nameOf(claim)}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABEL[claim.category]} · {fmt(claim.expenseDate)}
            {claim.clientBrandName ? ` · Client: ${claim.clientBrandName}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-sm font-black text-amber-700 tabular-nums">
          ₹{claim.amount.toLocaleString('en-IN')}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">“{claim.description}”</p>
      {claim.receiptFile?.filename && (
        <button type="button" onClick={openReceipt} disabled={openingReceipt} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          {openingReceipt ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />} View receipt
        </button>
      )}

      {claim.isOwn ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">This is your own claim — someone else has to decide it.</p>
          <AckButton keys={[ACTION_KEY.reimbursement(claim._id)]} />
        </div>
      ) : rejecting ? (
        <div className="mt-3 grid gap-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is this rejected? (the employee will see it)" className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
              Back
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() =>
                reject.mutate(
                  { id: claim._id, reason: reason.trim() },
                  { onSuccess: () => toast.success('Rejected — the employee has been told'), onError: (err) => toast.error(apiMessage(err, 'Could not reject')) }
                )
              }
            >
              Reject claim
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() =>
              approve.mutate(claim._id, {
                onSuccess: () => toast.success('Approved — Finance will pay it on Monday'),
                onError: (err) => toast.error(apiMessage(err, 'Could not approve')),
              })
            }
          >
            {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>
            <X className="size-3.5" /> Reject
          </Button>
          <AckButton keys={[ACTION_KEY.reimbursement(claim._id)]} />
        </div>
      )}
    </div>
  )
}

export function ReimbursementApprovalsCard() {
  const { user } = useAuth()
  const canApprove = can(user, 'payout_approval')
  const { data: allClaims = [] } = useReimbursementsAwaitingCeo(canApprove)
  const { shows } = useAckScope()
  const claims = allClaims.filter((c) => shows(ACTION_KEY.reimbursement(c._id)))
  const approve = useCeoApproveReimbursement()
  const [bulkBusy, setBulkBusy] = useState(false)
  if (!canApprove || claims.length === 0) return null

  const approvable = claims.filter((c) => !c.isOwn)
  const total = claims.reduce((t, c) => t + c.amount, 0)
  const approveAll = async () => {
    setBulkBusy(true)
    let done = 0
    for (const c of approvable) {
      try {
        await approve.mutateAsync(c._id)
        done += 1
      } catch (err) {
        toast.error(`${nameOf(c)}: ${apiMessage(err, 'could not approve')}`)
      }
    }
    setBulkBusy(false)
    if (done) toast.success(`Approved ${done} claim${done === 1 ? '' : 's'} — Finance will pay on Monday`)
  }

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-amber-500/[0.07] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow">
          <Receipt className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">Reimbursements waiting for your approval</p>
          <p className="text-xs text-muted-foreground">
            Finance has approved these. After your approval they are paid on the Monday after the week of the expense. ₹{total.toLocaleString('en-IN')} in
            all.
          </p>
        </div>
        {approvable.length > 1 && (
          <Button size="sm" variant="outline" onClick={approveAll} disabled={bulkBusy}>
            {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve all {approvable.length}
          </Button>
        )}
        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-white">{claims.length}</span>
      </div>
      <div className={cn('grid max-h-[34rem] gap-3 overflow-y-auto p-4', claims.length > 1 && 'md:grid-cols-2')}>
        {claims.map((c) => (
          <Row key={c._id} claim={c} />
        ))}
      </div>
    </div>
  )
}
