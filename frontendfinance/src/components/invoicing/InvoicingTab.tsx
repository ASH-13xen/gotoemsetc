import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarkPaidDialog } from '@/components/shared/MarkPaidDialog'
import { PlanPricesCard } from '@/components/invoicing/PlanPricesCard'
import { InvoiceSummaryCards } from '@/components/invoicing/InvoiceSummaryCards'
import { useAuth } from '@/hooks/useAuth'
import { canApproveInvoices } from '@/lib/roles'
import { useApproveInvoice, useGenerateInvoices, useInvoices, useMarkInvoicePaid } from '@/hooks/useInvoices'
import { downloadInvoicePdfBlob, type Invoice, type InvoiceStatus } from '@/api/invoices.api'

const STATUS_FILTERS: Array<{ value: InvoiceStatus | 'all'; label: string }> = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All' },
]

function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === 'paid') return <Badge variant="success">Paid</Badge>
  if (status === 'sent') return <Badge variant="secondary">Sent</Badge>
  return <Badge variant="warning">Pending approval</Badge>
}

async function viewPdf(id: string) {
  const blob = await downloadInvoicePdfBlob(id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const { user } = useAuth()
  const approve = useApproveInvoice()
  const markPaid = useMarkInvoicePaid()

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {invoice.client.brandName || invoice.client.name} — {invoice.invoiceNumber}
        </p>
        <p className="text-xs text-muted-foreground">
          {invoice.plan} · ₹{invoice.amount.toLocaleString('en-IN')} · {invoice.month}/{invoice.year}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={invoice.status} />
        <Button size="sm" variant="outline" onClick={() => viewPdf(invoice._id)}>
          View PDF
        </Button>
        {invoice.status === 'pending_approval' && canApproveInvoices(user) && (
          <Button
            size="sm"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate(invoice._id, {
                onSuccess: () => toast.success('Invoice approved and sent to client'),
                onError: () => toast.error('Could not approve invoice'),
              })
            }
          >
            Approve &amp; send
          </Button>
        )}
        {invoice.status === 'sent' && (
          <MarkPaidDialog
            trigger={<Button size="sm">Mark paid</Button>}
            title={`Mark ${invoice.invoiceNumber} as paid`}
            isPending={markPaid.isPending}
            onSubmit={(input) =>
              markPaid.mutateAsync(
                { id: invoice._id, input },
                {
                  onSuccess: () => toast.success('Invoice marked paid'),
                  onError: () => toast.error('Could not mark invoice paid'),
                }
              )
            }
          />
        )}
      </div>
    </Card>
  )
}

export function InvoicingTab() {
  const { user } = useAuth()
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('pending_approval')
  const filter = status === 'all' ? {} : { status }
  const { data, isLoading } = useInvoices(filter)
  const generate = useGenerateInvoices()
  const invoices = data?.invoices ?? []
  const canApprove = canApproveInvoices(user)

  return (
    <div className="space-y-4">
      <PlanPricesCard />
      <InvoiceSummaryCards filter={{}} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canApprove && (
          <Button
            size="sm"
            variant="outline"
            disabled={generate.isPending}
            onClick={() =>
              generate.mutate(
                {},
                {
                  onSuccess: ({ invoices: created }) => toast.success(`Generated ${created.length} invoice(s)`),
                  onError: () => toast.error('Could not generate invoices'),
                }
              )
            }
          >
            {generate.isPending ? 'Generating…' : "Generate last month's invoices"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices here.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <InvoiceRow key={inv._id} invoice={inv} />
          ))}
        </div>
      )}
    </div>
  )
}
