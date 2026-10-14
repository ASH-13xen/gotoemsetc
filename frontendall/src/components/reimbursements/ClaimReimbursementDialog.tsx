import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, Loader2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useFileReimbursement } from '@/hooks/useReimbursements'
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { CATEGORY_LABEL, TRAVEL_MODE_LABEL, type ReimbursementCategory, type TravelMode } from '@/api/reimbursements.api'
import { cn } from '@/lib/utils'

// The device's own calendar date — not toISOString(), which is UTC and still
// says "yesterday" until 5:30 in the morning here.
function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A reimbursement week runs Monday to Sunday and is paid on the Monday after
// it. Claims are only accepted for today or yesterday — and never for
// yesterday when today is Monday: Sunday closed the week being paid today,
// so a Sunday expense has to be claimed on Sunday itself (see
// backend/src/services/reimbursement.service.js#assertClaimWindow for the
// authoritative rule). Offering only valid choices here avoids explaining
// the rule to every employee — the backend still enforces it either way.
function claimableDates() {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const options = [{ label: 'Today', value: dateKey(today) }]
  if (today.getDay() !== 1) {
    options.push({ label: 'Yesterday', value: dateKey(yesterday) })
  }
  return options
}

// The Monday after the expense's Monday–Sunday week.
function payoutMonday(expenseDateKey: string) {
  const [y, m, d] = expenseDateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const daysToNextMonday = ((8 - date.getDay()) % 7) || 7
  return new Date(y, m - 1, d + daysToNextMonday).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function ClaimReimbursementDialog() {
  const [open, setOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [category, setCategory] = useState<ReimbursementCategory>('miscellaneous')
  const [travelMode, setTravelMode] = useState<TravelMode>('cab')
  const [clientBrandName, setClientBrandName] = useState('')
  const dateOptions = claimableDates()
  const [expenseDate, setExpenseDate] = useState(dateOptions[0].value)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [peopleInvolved, setPeopleInvolved] = useState<string[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const { data: employeesData } = useOpenEmployeeDirectory()
  const fileReimbursement = useFileReimbursement()

  const togglePerson = (id: string) => {
    setPeopleInvolved((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const reset = () => {
    setCategory('miscellaneous')
    setClientBrandName('')
    setDescription('')
    setAmount('')
    setPeopleInvolved([])
    setReceiptFile(null)
  }

  const onSubmit = () => {
    if (!description.trim() || !amount) {
      toast.error('Please fill in the amount and description')
      return
    }
    if (!receiptFile) {
      toast.error('Attach the receipt — a claim needs one')
      return
    }
    fileReimbursement.mutate(
      {
        input: {
          category,
          travelMode: category === 'travel' ? travelMode : undefined,
          clientBrandName: clientBrandName.trim() || undefined,
          expenseDate,
          description: description.trim(),
          peopleInvolved,
          amount: Number(amount),
        },
        receipt: receiptFile,
      },
      {
        onSuccess: () => {
          toast.success(`Claim sent to Finance — once approved it is paid on ${payoutMonday(expenseDate)}`)
          setOpen(false)
          reset()
        },
        onError: (err) =>
          toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not file the claim'),
      }
    )
  }

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-border">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary/60"
          >
            <Receipt className="size-4" />
            Claim reimbursement
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim a reimbursement</DialogTitle>
          <DialogDescription>
            A week runs Monday to Sunday and is paid on the following Monday, after Finance and the CEO approve.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ReimbursementCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category === 'travel' && (
            <div className="grid gap-1.5">
              <Label>Travel mode</Label>
              <Select value={travelMode} onValueChange={(v) => setTravelMode(v as TravelMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRAVEL_MODE_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="clientBrandName">Client name</Label>
            <Input id="clientBrandName" value={clientBrandName} onChange={(e) => setClientBrandName(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>Expense date</Label>
            <Select value={expenseDate} onValueChange={setExpenseDate}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label} ({d.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="reimbDescription">Description</Label>
            <Textarea
              id="reimbDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="reimbAmount">Amount (₹)</Label>
            <Input id="reimbAmount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>People involved</Label>
            <div className="flex flex-wrap gap-1.5">
              {(employeesData ?? []).map((emp) => {
                const selected = peopleInvolved.includes(emp._id)
                return (
                  <button
                    key={emp._id}
                    type="button"
                    onClick={() => togglePerson(emp._id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    )}
                  >
                    {emp.firstName} {emp.lastName ?? ''}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="receipt">Receipt</Label>
            <Input
              id="receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={fileReimbursement.isPending || !receiptFile}>
            {fileReimbursement.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit claim
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="my-1.5 w-px bg-border" />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center px-2.5 text-muted-foreground transition-colors duration-150 hover:bg-secondary/60 hover:text-foreground"
            aria-label="How claiming a reimbursement works"
          >
            <Eye className="size-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How claiming a reimbursement works</DialogTitle>
            <DialogDescription>What each field means, and what happens after you submit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">When you can claim</p>
              <p className="text-muted-foreground">
                Only for an expense from today or yesterday — you can't backdate further than that. A week runs
                Monday to Sunday and is paid on the Monday after it. The one exception: on a Monday, "yesterday"
                (Sunday) isn't offered, since Monday is payment day for the week that just closed — a Sunday expense
                has to be claimed on Sunday itself.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Category</p>
              <p className="text-muted-foreground">
                Pick whichever fits: Client Work, Grocery, Travel, Stationery, Influencer, Camera/Accessories, Meta
                Ads, or Miscellaneous.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Travel mode (Travel only)</p>
              <p className="text-muted-foreground">Required when the category is Travel — Cab (Ola/Rapido/Uber) or Bike/Petrol.</p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Client name</p>
              <p className="text-muted-foreground">Type the client this expense was for, if it was for one.</p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Description, amount</p>
              <p className="text-muted-foreground">
                Both are required — describe what the expense was for and how much to reimburse.
              </p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">People involved</p>
              <p className="text-muted-foreground">Optional — tag any other employees who were part of this expense.</p>
            </div>
            <div className="grid gap-1">
              <p className="font-semibold text-foreground">Receipt</p>
              <p className="text-muted-foreground">
                Required. Attach a PDF or image of the bill — a claim can't be submitted without one.
              </p>
            </div>
            <div className="grid gap-1 border-t border-border pt-3">
              <p className="font-semibold text-foreground">What happens after you submit</p>
              <p className="text-muted-foreground">
                Finance is notified immediately and reviews it, then it goes to the CEO for the final approval —
                either can reject it with a reason. Once both have approved, it's paid on the Monday after the week
                of the expense, and you get the payment proof. You can track the status (Pending / Waiting for the
                CEO / Approved / Paid / Rejected) on your dashboard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)} className="w-full">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
