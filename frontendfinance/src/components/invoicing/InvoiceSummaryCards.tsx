import { Card } from '@/components/ui/card'
import { useInvoiceSummary } from '@/hooks/useInvoices'
import type { InvoiceFilter } from '@/api/invoices.api'

export function InvoiceSummaryCards({ filter }: { filter: InvoiceFilter }) {
  const { data } = useInvoiceSummary(filter)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total received</p>
        <p className="mt-1 text-2xl font-extrabold text-foreground">₹{(data?.totalReceived ?? 0).toLocaleString('en-IN')}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total due</p>
        <p className="mt-1 text-2xl font-extrabold text-foreground">₹{(data?.totalDue ?? 0).toLocaleString('en-IN')}</p>
      </Card>
      {data && data.byClient.length > 0 && (
        <Card className="p-4 sm:col-span-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">By client</p>
          <div className="space-y-1.5">
            {data.byClient.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.clientName}</span>
                <span className="text-muted-foreground">
                  Received ₹{c.received.toLocaleString('en-IN')} · Due ₹{c.due.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
