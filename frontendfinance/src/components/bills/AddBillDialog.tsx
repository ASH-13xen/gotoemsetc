import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateBill } from '@/hooks/useMonthlyBills'

export function AddBillDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const createBill = useCreateBill()

  function handleSubmit() {
    if (!name.trim() || !amount) return
    createBill.mutate(
      { name: name.trim(), amount: Number(amount), dueDay: Number(dueDay) },
      {
        onSuccess: () => {
          toast.success('Bill added')
          setOpen(false)
          setName('')
          setAmount('')
          setDueDay('1')
        },
        onError: () => toast.error('Could not add bill'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add bill</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a monthly bill</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="billName">Name</Label>
            <Input id="billName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Office rent" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="billAmount">Amount (₹)</Label>
            <Input id="billAmount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="billDueDay">Due day of month</Label>
            <Input
              id="billDueDay"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createBill.isPending}>
            {createBill.isPending ? 'Adding…' : 'Add bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
