import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { useFinanceSlips, useMarkSalaryPaid } from '@/hooks/useSalarySlips'
import { downloadFinanceMasterSheet, downloadFinanceSlip, downloadSalaryReceipt } from '@/api/salarySlips.api'

// Slips and receipts sit behind the login, so they are fetched with the
// session and opened from memory rather than linked to directly.
async function openBlob(load: () => Promise<Blob>, failed: string) {
  try {
    const url = URL.createObjectURL(await load())
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    toast.error(failed)
  }
}

const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Salaries are paid for the month just gone, so that is where the tab opens.
function currentYearMonth() {
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  return { year: lastMonth.getFullYear(), month: lastMonth.getMonth() + 1 }
}

export function SalaryTab() {
  const [{ year, month }, setPeriod] = useState(currentYearMonth())
  const { data, isLoading } = useFinanceSlips(year, month)
  const markPaid = useMarkSalaryPaid()
  const slips = data?.slips ?? []

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(month)} onValueChange={(v) => setPeriod((p) => ({ ...p, month: Number(v) }))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABEL.map((label, i) => (
              <SelectItem key={label} value={String(i + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setPeriod((p) => ({ ...p, year: Number(v) }))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {slips.length > 0 && (
          <Button
            variant="outline"
            onClick={() => openBlob(() => downloadFinanceMasterSheet(year, month), 'Could not open the master salary sheet')}
          >
            Master salary sheet
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Only slips the CEO or admin has approved are listed. Each payment is marked paid with its receipt, which is mailed to the
        employee.
        {slips.length > 0 &&
          ` ${slips.filter((s) => s.paymentStatus === 'paid').length} of ${slips.length} paid · ₹${slips
            .filter((s) => s.paymentStatus !== 'paid')
            .reduce((t, s) => t + Number(s.netPayable), 0)
            .toLocaleString('en-IN')} still due.`}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground">No approved salary slips for this month yet.</p>
      ) : (
        <div className="space-y-2">
          {slips.map((slip) => {
            const employeeName = `${slip.employee.firstName} ${slip.employee.lastName || ''}`.trim()
            return (
              <Card key={slip._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{employeeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {slip.employee.employeeCode ? `${slip.employee.employeeCode} · ` : ''}
                    ₹{Number(slip.netPayable).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openBlob(() => downloadFinanceSlip(slip._id), 'Could not open the salary slip')}>
                    View slip
                  </Button>
                  {slip.paymentReceiptFile?.filename && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openBlob(() => downloadSalaryReceipt(slip._id), 'Could not open the receipt')}
                    >
                      View receipt
                    </Button>
                  )}
                  {slip.paymentStatus === 'paid' ? (
                    <Badge variant="success">Paid</Badge>
                  ) : (
                    <Badge variant="warning">Due</Badge>
                  )}
                  {slip.paymentStatus === 'due' && (
                    <MarkPaidDialog
                      trigger={<Button size="sm">Mark paid</Button>}
                      title={`Mark ${employeeName}'s salary as paid`}
                      description="Attach the payment receipt — it is mailed to the employee and shown to them on their dashboard."
                      isPending={markPaid.isPending}
                      requireProof
                      proofLabel="Payment receipt"
                      proofHint="Required — mailed to the employee's company mail and shown on their dashboard. Image or PDF, up to 10 MB."
                      onSubmit={(input, receipt) =>
                        markPaid.mutateAsync(
                          { id: slip._id, input, receipt: receipt as File },
                          {
                            onSuccess: () => toast.success('Salary marked paid — the receipt has been sent to the employee'),
                            onError: (err) =>
                              toast.error(
                                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not mark salary paid'
                              ),
                          }
                        )
                      }
                    />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
