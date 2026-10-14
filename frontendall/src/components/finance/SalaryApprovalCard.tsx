import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Download, FileStack, Loader2, MailWarning, Undo2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { can } from '@/lib/access'
import { approveSalaryBatch, downloadSalaryBatchZip, listSalaryBatches, sendBackSalaryBatch, type SalaryBatch } from '@/api/salaryApprovals.api'

// Salary slips waiting for the CEO or admin. Nothing is mailed and Finance
// sees nothing until "Approve all": then every employee is mailed their own
// slip, Finance is mailed the master sheet, and the slips show up in the
// Finance tab. Or the batch goes back to HR with a note.

const KEY = ['salary-batches']
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

function saveBlobAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function MailReport({ batch }: { batch: SalaryBatch }) {
  const notSent = batch.emailResults.filter((r) => r.status !== 'sent')
  const sheetFailed = batch.masterSheetEmail?.status === 'failed'
  if (notSent.length === 0 && !sheetFailed) return null
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/[0.06] p-3 text-xs">
      <p className="flex items-center gap-1.5 font-bold text-destructive">
        <MailWarning className="size-3.5" /> {batch.periodLabel} — could not be mailed
      </p>
      <ul className="mt-1.5 grid gap-0.5 text-foreground">
        {notSent.map((r) => (
          <li key={r.employeeName + (r.to ?? '')} className="capitalize">
            {r.employeeName.toLowerCase()}
            <span className="normal-case text-muted-foreground">
              {' '}
              — {r.status === 'no_address' ? 'no Company Mail ID on their record' : `failed${r.to ? ` (${r.to})` : ''}${r.error ? `: ${r.error}` : ''}`}
            </span>
          </li>
        ))}
        {sheetFailed && (
          <li>
            Master sheet to Finance
            <span className="text-muted-foreground"> — failed{batch.masterSheetEmail?.error ? `: ${batch.masterSheetEmail.error}` : ''}</span>
          </li>
        )}
      </ul>
      <p className="mt-1.5 text-muted-foreground">The slips are approved and in the Finance tab; only these mails did not go out.</p>
    </div>
  )
}

function BatchRow({ batch }: { batch: SalaryBatch }) {
  const queryClient = useQueryClient()
  const [sendingBack, setSendingBack] = useState(false)
  const [note, setNote] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [result, setResult] = useState<SalaryBatch | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY })
  const approve = useMutation({ mutationFn: () => approveSalaryBatch(batch._id) })
  const sendBack = useMutation({ mutationFn: () => sendBackSalaryBatch(batch._id, note.trim()), onSuccess: refresh })
  const zip = useMutation({ mutationFn: () => downloadSalaryBatchZip(batch) })
  const busy = approve.isPending || sendBack.isPending
  const shown = showAll ? batch.slips : batch.slips.slice(0, 6)

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-foreground">
            {batch.periodLabel} · {batch.slipCount} salary slip{batch.slipCount === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.kind === 'bulk' ? "The month's slips from HR Work" : 'A single slip generated from the employee page'}
            {batch.createdByInfo ? ` · by ${batch.createdByInfo.name}` : ''} ·{' '}
            {new Date(batch.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-black text-primary tabular-nums">{rupees(batch.totalNetPayable)}</span>
      </div>

      <div className="mt-3 grid gap-1 sm:grid-cols-2">
        {shown.map((s) => (
          <div key={s._id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs">
            <span className="min-w-0 truncate font-semibold text-foreground capitalize">
              {s.employeeName.toLowerCase()}
              {!s.companyEmail && <span className="ml-1.5 font-medium normal-case text-amber-700">· no company mail</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{rupees(s.netPayable)}</span>
          </div>
        ))}
      </div>
      {batch.slips.length > 6 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-xs font-semibold text-primary hover:underline">
          {showAll ? 'Show fewer' : `Show all ${batch.slips.length}`}
        </button>
      )}

      {batch.withoutCompanyEmail > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {batch.withoutCompanyEmail} {batch.withoutCompanyEmail === 1 ? 'person has' : 'people have'} no Company Mail ID, so their slip can't be
          mailed. You can still approve — you'll get the list — or have HR add the mail id in EMS first.
        </p>
      )}

      {sendingBack ? (
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
                  onSuccess: () => toast.success('Sent back to HR — nothing was mailed'),
                  onError: (err) => toast.error(apiMessage(err, 'Could not send it back')),
                })
              }
            >
              {sendBack.isPending && <Loader2 className="size-3.5 animate-spin" />} Send back to HR
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={zip.isPending}
            onClick={() =>
              zip.mutate(undefined, {
                onSuccess: (blob) => saveBlobAs(blob, `salary-slips-${batch.periodLabel.replace(' ', '-')}.zip`),
                onError: () => toast.error('Could not build the zip'),
              })
            }
          >
            {zip.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Download zip (slips + master sheet)
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={busy}
            onClick={() =>
              approve.mutate(undefined, {
                onSuccess: (approved) => setResult(approved),
                onError: (err) => {
                  toast.error(apiMessage(err, 'Could not approve'))
                  refresh()
                },
              })
            }
          >
            {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {approve.isPending ? 'Approving and mailing…' : 'Approve all'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSendingBack(true)} disabled={busy}>
            <Undo2 className="size-3.5" /> Send back
          </Button>
        </div>
      )}
      {approve.isPending && (
        <p className="mt-2 text-xs text-muted-foreground">Mailing each employee their slip — this takes a few seconds per slip. Keep this page open.</p>
      )}

      {/* What happened to the mails — shown once, then the batch moves to "recently approved". */}
      <Dialog
        open={Boolean(result)}
        onOpenChange={(open) => {
          if (!open) {
            setResult(null)
            refresh()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salary slips approved</DialogTitle>
            <DialogDescription>
              {result &&
                `${result.emailResults.filter((r) => r.status === 'sent').length} of ${result.emailResults.length} slip${
                  result.emailResults.length === 1 ? '' : 's'
                } mailed to the employees. ${
                  result.masterSheetEmail?.status === 'sent'
                    ? `The master sheet was mailed to Finance (${result.masterSheetEmail.to}).`
                    : 'The master sheet could not be mailed to Finance.'
                } The slips are now in the Finance tab.`}
            </DialogDescription>
          </DialogHeader>
          {result && <MailReport batch={result} />}
          <DialogFooter>
            <Button
              onClick={() => {
                setResult(null)
                refresh()
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SalaryApprovalCard() {
  const { user } = useAuth()
  const canApprove = can(user, 'payout_approval')
  const { data } = useQuery({ queryKey: KEY, queryFn: listSalaryBatches, enabled: canApprove, refetchInterval: 60_000 })
  if (!canApprove || !data) return null
  // Approved in the last two weeks with a mail that did not go out — kept
  // in view so it isn't lost.
  const withFailures = data.recent.filter((b) => b.emailResults.some((r) => r.status !== 'sent') || b.masterSheetEmail?.status === 'failed')
  if (data.pending.length === 0 && withFailures.length === 0) return null

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-primary/30 bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-primary/[0.06] px-5 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow">
          <FileStack className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-black text-foreground">Salary slips waiting for your approval</p>
          <p className="text-xs text-muted-foreground">
            Approving mails every employee their own slip, mails the master sheet to Finance, and puts the slips in the Finance tab.
          </p>
        </div>
        {data.pending.length > 0 && <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-black text-primary-foreground">{data.pending.length}</span>}
      </div>
      <div className="grid gap-3 p-4">
        {data.pending.map((b) => (
          <BatchRow key={b._id} batch={b} />
        ))}
        {data.pending.length === 0 && <p className="text-xs text-muted-foreground">Nothing is waiting. Recently approved, with mails that did not go out:</p>}
        {withFailures.map((b) => (
          <MailReport key={b._id} batch={b} />
        ))}
      </div>
    </div>
  )
}
