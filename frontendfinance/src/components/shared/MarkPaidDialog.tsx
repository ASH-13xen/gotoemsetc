import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAYMENT_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Other']

export interface TransactionDetailsInput {
  mode?: string
  referenceNumber?: string
  paidOn?: string
  note?: string
}

// Shared "record how it was paid" step, reused across every Finance
// section's mark-paid action (Salary, FnF, Invoicing, Monthly Bills,
// Reimbursements) — each backend model stores the same
// {mode, referenceNumber, paidOn, note} shape. `requireProof` adds a
// mandatory payment screenshot (reimbursements — the claimant sees it); the
// file comes back as onSubmit's second argument.
export function MarkPaidDialog({
  trigger,
  title,
  description,
  onSubmit,
  isPending,
  requireProof = false,
}: {
  trigger: ReactNode
  title: string
  description?: string
  onSubmit: (details: TransactionDetailsInput, proof?: File) => Promise<unknown> | void
  isPending?: boolean
  requireProof?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('Bank Transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<File | undefined>()

  async function handleSubmit() {
    if (requireProof && !proof) {
      toast.error('Attach a screenshot of the payment first')
      return
    }
    try {
      await onSubmit({ mode, referenceNumber: referenceNumber || undefined, paidOn, note: note || undefined }, proof)
    } catch {
      // The caller reports the failure; keep the dialog (and the file) as they are.
      return
    }
    setOpen(false)
    setReferenceNumber('')
    setNote('')
    setProof(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Payment mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="referenceNumber">Reference / transaction number</Label>
            <Input
              id="referenceNumber"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="paidOn">Paid on</Label>
            <Input id="paidOn" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          {requireProof && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="paymentProof">Payment screenshot</Label>
              <Input
                id="paymentProof"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => setProof(e.target.files?.[0])}
              />
              <p className="text-xs text-muted-foreground">
                Required — the employee sees this as proof of payment on their dashboard. Image or PDF, up to 10 MB.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || (requireProof && !proof)}>
            {isPending ? 'Marking paid…' : 'Mark paid'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
