import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Receipt } from 'lucide-react'
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
import { useFileReimbursement, useUploadReceipt } from '@/hooks/useReimbursements'
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { useClientDirectory } from '@/hooks/useClients'
import { CATEGORY_LABEL, TRAVEL_MODE_LABEL, type ReimbursementCategory, type TravelMode } from '@/api/reimbursements.api'
import { cn } from '@/lib/utils'

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Claims are only accepted for today or yesterday — and never for yesterday
// when yesterday was a Saturday (the weekly payment cutoff; see
// backend/src/services/reimbursement.service.js#assertClaimWindow for the
// authoritative rule). Offering only valid choices here avoids explaining
// the rule to every employee — the backend still enforces it either way.
function claimableDates() {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const options = [{ label: 'Today', value: dateKey(today) }]
  if (today.getDay() !== 0) {
    options.push({ label: 'Yesterday', value: dateKey(yesterday) })
  }
  return options
}

export function ClaimReimbursementDialog() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ReimbursementCategory>('miscellaneous')
  const [travelMode, setTravelMode] = useState<TravelMode>('cab')
  const [clientId, setClientId] = useState<string>('')
  const [clientBrandName, setClientBrandName] = useState('')
  const dateOptions = claimableDates()
  const [expenseDate, setExpenseDate] = useState(dateOptions[0].value)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [peopleInvolved, setPeopleInvolved] = useState<string[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const { data: employeesData } = useOpenEmployeeDirectory()
  const { data: clientsData } = useClientDirectory()
  const fileReimbursement = useFileReimbursement()
  const uploadReceipt = useUploadReceipt()

  const togglePerson = (id: string) => {
    setPeopleInvolved((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  const reset = () => {
    setCategory('miscellaneous')
    setClientId('')
    setClientBrandName('')
    setStartAt('')
    setEndAt('')
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
    fileReimbursement.mutate(
      {
        category,
        travelMode: category === 'travel' ? travelMode : undefined,
        client: category === 'client_work' && clientId ? clientId : undefined,
        clientBrandName: category === 'client_work' && !clientId ? clientBrandName.trim() || undefined : undefined,
        expenseDate,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        description: description.trim(),
        peopleInvolved,
        amount: Number(amount),
      },
      {
        onSuccess: ({ reimbursement }) => {
          if (receiptFile) {
            uploadReceipt.mutate({ id: reimbursement._id, file: receiptFile })
          }
          toast.success('Reimbursement claimed — CEO has been notified')
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not file the claim'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl">
          <Receipt className="size-4" />
          Claim reimbursement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim a reimbursement</DialogTitle>
          <DialogDescription>Approved claims are paid on Saturdays.</DialogDescription>
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

          {category === 'client_work' && (
            <>
              <div className="grid gap-1.5">
                <Label>Client / brand</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientsData ?? []).map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!clientId && (
                <div className="grid gap-1.5">
                  <Label htmlFor="clientBrandName">Or type a brand name</Label>
                  <Input
                    id="clientBrandName"
                    value={clientBrandName}
                    onChange={(e) => setClientBrandName(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="startAt">Start</Label>
              <Input id="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endAt">End</Label>
              <Input id="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
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
            <Label htmlFor="receipt">Receipt (optional)</Label>
            <Input
              id="receipt"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={fileReimbursement.isPending}>
            {fileReimbursement.isPending && <Loader2 className="size-4 animate-spin" />}
            Submit claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
