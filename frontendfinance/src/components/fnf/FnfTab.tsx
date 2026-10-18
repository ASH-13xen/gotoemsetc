import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { useFnfSettlements, useMarkFnfPaid } from '@/hooks/useFnfSettlements'
import { downloadFnfFile } from '@/api/fnfSettlements.api'

// Full & final settlements the CEO/admin has approved. One payment covers
// the final salary slip and the severance; it is marked paid with its
// receipt, which is mailed to the employee's personal mail (they have left).

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

async function openFile(id: string, which: 'document' | 'slip' | 'payment-receipt', failed: string) {
  try {
    const url = URL.createObjectURL(await downloadFnfFile(id, which))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    toast.error(failed)
  }
}

export function FnfTab() {
  const { data, isLoading } = useFnfSettlements()
  const markPaid = useMarkFnfPaid()
  const settlements = data?.settlements ?? []

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    )
  }

  if (settlements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Full &amp; Final settlements to pay. A settlement appears here once HR has confirmed the last working day and the CEO (or
        admin) has approved it with the final salary slip.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {settlements.map((settlement) => {
        const employeeName = `${settlement.employee.firstName} ${settlement.employee.lastName || ''}`.trim()
        const hasSlip = Boolean(settlement.salarySlip)
        return (
          <Card key={settlement._id} className="flex flex-col justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{employeeName}</p>
                {settlement.status === 'paid' ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Due</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {settlement.employee.employeeCode ? `${settlement.employee.employeeCode} · ` : ''}
                {settlement.lastWorkingDay ? `Last working day ${fmt(settlement.lastWorkingDay)} · ` : ''}
                {hasSlip
                  ? `Final salary ${rupees(settlement.finalSalary)} + severance ${rupees(settlement.severance)} = ${rupees(settlement.total)}`
                  : settlement.amount != null
                    ? rupees(settlement.amount)
                    : 'Amount not on file'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => openFile(settlement._id, 'document', 'Could not open the settlement document')}>
                Document
              </Button>
              {hasSlip && (
                <Button size="sm" variant="outline" onClick={() => openFile(settlement._id, 'slip', 'Could not open the final salary slip')}>
                  Final slip
                </Button>
              )}
              {settlement.paymentReceiptFile?.filename && (
                <Button size="sm" variant="outline" onClick={() => openFile(settlement._id, 'payment-receipt', 'Could not open the receipt')}>
                  Receipt
                </Button>
              )}
              {settlement.status === 'due' && (
                <MarkPaidDialog
                  trigger={<Button size="sm">Mark paid</Button>}
                  title={`Mark ${employeeName}'s FnF settlement as paid`}
                  description={`Pay ${rupees(hasSlip ? settlement.total : settlement.amount ?? 0)} in all. The receipt and the settlement document are mailed to the employee.`}
                  isPending={markPaid.isPending}
                  requireProof
                  proofLabel="Payment receipt"
                  proofHint="Required — mailed to the employee's personal mail. Image or PDF, up to 10 MB."
                  onSubmit={(input, receipt) =>
                    markPaid.mutateAsync(
                      { id: settlement._id, input, receipt: receipt as File },
                      {
                        onSuccess: () => toast.success('Settlement marked paid — the receipt has been sent to the employee'),
                        onError: (err) =>
                          toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not mark settlement paid'),
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
  )
}
