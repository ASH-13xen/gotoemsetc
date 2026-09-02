import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, PlayCircle } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDownloadBulkSalarySlipZip, useGenerateBulkSalarySlips } from '@/hooks/useSalarySlips'
import type { BulkSlipOutcome } from '@/api/salarySlips.api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const OUTCOME_VARIANT: Record<BulkSlipOutcome, 'success' | 'warning' | 'destructive'> = {
  generated: 'success',
  skipped: 'warning',
  failed: 'destructive',
}

export default function SalarySlipsBulkPage() {
  // Default to the last fully-completed month, not the current one — the
  // backend rejects generating a slip for a period that hasn't ended yet,
  // and the current calendar month always fails that check on day one.
  const now = new Date()
  const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [month, setMonth] = useState(lastCompletedMonth.getMonth() + 1)
  const [year, setYear] = useState(lastCompletedMonth.getFullYear())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const generate = useGenerateBulkSalarySlips()
  const downloadZip = useDownloadBulkSalarySlipZip()

  // Triggers the browser's native download by momentarily attaching a
  // hidden <a download> to the DOM — there's no way to hand a Blob straight
  // to the OS save dialog otherwise.
  const saveBlobAs = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const onConfirm = () => {
    generate.mutate(
      { month, year },
      {
        onSuccess: (data) => {
          setConfirmOpen(false)
          const generatedSlips = data.results.filter((r) => r.outcome === 'generated' && r.slipId)
          toast.success(`Generated ${generatedSlips.length} of ${data.results.length} salary slips`)

          if (generatedSlips.length === 0) return
          const filename = `salary-slips-${MONTHS[month - 1]}-${year}.zip`
          downloadZip.mutate(
            { slipIds: generatedSlips.map((r) => r.slipId as string), filename },
            {
              onSuccess: (blob) => {
                saveBlobAs(blob, filename)
                toast.success('Salary slips downloaded as a zip')
              },
              onError: () => toast.error('Slips were generated, but the zip download failed'),
            }
          )
        },
        onError: (err) => {
          setConfirmOpen(false)
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not generate salary slips'
          toast.error(message)
        },
      }
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="Generate salary slips"
        description="Generate every active employee's salary slip for one calendar month in a single action. An employee who joined mid-month gets their slip clipped to start from their actual join date."
      />

      <Card className="p-6">
        <CardContent className="flex flex-wrap items-end gap-4 p-0">
          <div className="grid gap-1.5">
            <Label>Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Generate for all employees
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate salary slips for {MONTHS[month - 1]} {year}?</DialogTitle>
            <DialogDescription>
              This creates a new salary slip (with its own PDF) for every active employee for this period. Employees
              who joined during this month will have their slip start from their join date. This does not overwrite
              or remove any existing slip.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generate.isPending}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={generate.isPending}>
              {generate.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm & generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {generate.data && (
        <Card className="p-6">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generate.data.results.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell className="font-medium text-foreground">{r.employeeName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.employeeCode}</TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME_VARIANT[r.outcome]}>{r.outcome}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.outcome === 'generated'
                        ? `Net payable: ${r.netPayable?.toFixed(2)}`
                        : r.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
