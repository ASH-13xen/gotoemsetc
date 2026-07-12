import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useGenerateSalarySlip } from '@/hooks/useSalarySlips'
import { downloadSalarySlip } from '@/api/salarySlips.api'

const MANUAL_FIELDS: { key: string; label: string }[] = [
  { key: 'incomeTaxDeduction', label: 'Income Tax Deduction' },
  { key: 'professionTax', label: 'Profession Tax' },
  { key: 'pf', label: 'P.F.' },
  { key: 'otherDeduction3', label: 'Other Deduction 3' },
  { key: 'compensationOff', label: 'Compensation Off' },
  { key: 'incentives', label: 'Incentives' },
  { key: 'travelAllowance', label: 'Travel Allowance' },
  { key: 'otherEarning1', label: 'Other Earning 1' },
  { key: 'reimbursement1', label: 'Reimbursement 1' },
  { key: 'reimbursement2', label: 'Reimbursement 2' },
]

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function GenerateSalarySlipDialog({
  employeeId,
  employeeName,
  trigger,
}: {
  employeeId: string
  employeeName: string
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(todayInputValue())
  const [endDate, setEndDate] = useState(todayInputValue())
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const generateSlip = useGenerateSalarySlip(employeeId)

  const reset = () => {
    setStartDate(todayInputValue())
    setEndDate(todayInputValue())
    setInputs({})
  }

  const onSubmit = () => {
    if (!startDate || !endDate) {
      toast.error('Pick a start and end date')
      return
    }
    if (endDate < startDate) {
      toast.error('End date must be on or after the start date')
      return
    }
    const payload: Record<string, number> = {}
    for (const field of MANUAL_FIELDS) {
      const raw = inputs[field.key]
      if (raw && raw.trim()) payload[field.key] = Number(raw)
    }

    generateSlip.mutate(
      { startDate, endDate, ...payload },
      {
        onSuccess: async ({ slip }) => {
          toast.success('Salary slip generated')
          await downloadSalarySlip(slip._id, `${employeeName}-${startDate}_to_${endDate}.pdf`)
          setOpen(false)
          reset()
        },
        onError: () => toast.error('Could not generate salary slip — check attendance data and try again'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Salary Slip</DialogTitle>
          <DialogDescription>
            Days worked, overtime, and attendance-based deductions are computed automatically from the start
            date through the end date below — any range works, it doesn't need to line up with a calendar
            month. Everything else defaults to 0 if left blank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="slip-start-date">Start Date</Label>
              <Input
                id="slip-start-date"
                type="date"
                max={endDate || todayInputValue()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="slip-end-date">End Date</Label>
              <Input
                id="slip-end-date"
                type="date"
                min={startDate}
                max={todayInputValue()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {MANUAL_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`slip-${field.key}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`slip-${field.key}`}
                  type="number"
                  placeholder="0"
                  value={inputs[field.key] ?? ''}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={generateSlip.isPending}>
            {generateSlip.isPending && <Loader2 className="size-4 animate-spin" />}
            Generate & Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
