import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, Loader2, Paperclip } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { closePaidSalaryNotice, fetchSalaryReceipt, listMyPaidSalaryNotices, type PaidSlipNotice } from '@/api/salaryApprovals.api'

// Shown to an employee the moment Finance has marked their salary paid —
// the same can't-be-missed pattern as PendingAnnouncementsModal: it stays
// until each notice is closed with "Got it". The receipt Finance attached
// is one click away (and was also mailed to their company mail).

const KEY = ['salary-paid-notices']
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const monthOf = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function Notice({ slip }: { slip: PaidSlipNotice }) {
  const queryClient = useQueryClient()
  const [opening, setOpening] = useState(false)
  const close = useMutation({
    mutationFn: () => closePaidSalaryNotice(slip._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })

  const openReceipt = async () => {
    setOpening(true)
    try {
      const url = URL.createObjectURL(await fetchSalaryReceipt(slip._id))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Could not open the receipt')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="rounded-xl bg-emerald-500/[0.08] p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <BadgeCheck className="size-4 text-emerald-600" /> Salary for {monthOf(slip.startDate)}
      </p>
      <p className="mt-1 text-2xl font-black tracking-tight text-foreground tabular-nums">
        ₹{slip.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Paid{slip.paidAt ? ` on ${fmt(slip.paidAt)}` : ''}
        {slip.transactionDetails?.mode ? ` · ${slip.transactionDetails.mode}` : ''}
        {slip.transactionDetails?.referenceNumber ? ` · Ref ${slip.transactionDetails.referenceNumber}` : ''}
      </p>
      {slip.transactionDetails?.note && <p className="mt-1 text-xs text-foreground">{slip.transactionDetails.note}</p>}
      <div className="mt-3 flex gap-2">
        {slip.paymentReceiptFile?.filename && (
          <Button size="sm" variant="outline" className="flex-1" onClick={openReceipt} disabled={opening}>
            {opening ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />} View receipt
          </Button>
        )}
        <Button size="sm" className="flex-1" onClick={() => close.mutate()} disabled={close.isPending}>
          Got it
        </Button>
      </div>
    </div>
  )
}

export function SalaryPaidModal() {
  const { user } = useAuth()
  const { data: notices = [] } = useQuery({ queryKey: KEY, queryFn: listMyPaidSalaryNotices, enabled: Boolean(user?.employeeLink) })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (notices.length > 0) setOpen(true)
  }, [notices.length])

  if (notices.length === 0) return null

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Your salary has been paid</DialogTitle>
          <DialogDescription>Finance has marked the payment done. The receipt was also sent to your company mail.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {notices.map((slip) => (
            <Notice key={slip._id} slip={slip} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
