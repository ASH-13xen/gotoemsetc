import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerateQuotationDialog } from './GenerateQuotationDialog'
import { AdminSignDialog } from './AdminSignDialog'
import { QuotationShareLink } from './QuotationShareLink'
import { useQuotations } from '@/hooks/useQuotations'
import { openQuotationFile } from '@/api/quotations.api'
import type { Quotation, QuotationStatus } from '@/api/quotations.api'

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'border-neutral-200 bg-secondary text-muted-foreground',
  shared: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
  signed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  superseded: 'border-neutral-200 bg-secondary/50 text-muted-foreground/60',
}

function planLabel(quotation: Quotation) {
  if (!quotation.planOptionKey) return null
  return (
    quotation.template?.planOptions?.find((o) => o.key === quotation.planOptionKey)?.label ?? quotation.planOptionKey
  )
}

function QuotationRow({
  clientId,
  clientName,
  contactEmail,
  contactPhone,
  quotation,
}: {
  clientId: string
  clientName: string
  contactEmail?: string
  contactPhone?: string
  quotation: Quotation
}) {
  const label = planLabel(quotation)
  const downloadVariant = quotation.finalSignedFile ? 'final' : quotation.adminSignedFile ? 'admin-signed' : 'draft'

  return (
    <div className={`grid gap-3 py-4 first:pt-0 last:pb-0 ${quotation.status === 'superseded' ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide text-foreground">
              v{quotation.version} — {quotation.template.title}
            </span>
            <span className={`border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full ${STATUS_STYLES[quotation.status]}`}>
              {quotation.status}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {label ? `${label} · ` : ''}
            {new Date(quotation.createdAt).toLocaleDateString()}
            {quotation.signedAt ? ` · Signed ${new Date(quotation.signedAt).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              openQuotationFile(quotation._id, downloadVariant).catch(() => toast.error('Could not open quotation file'))
            }}
          >
            <Download className="size-3.5" />
            {quotation.status === 'signed' ? 'FINAL PDF' : 'PREVIEW'}
          </Button>
          <AdminSignDialog
            clientId={clientId}
            quotationId={quotation._id}
            canSign={quotation.status === 'draft'}
            clientName={clientName}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
          />
        </div>
      </div>

      {/* Awaiting the client's signature — the share link stays available
          here for as long as that's true, not just in the moment right
          after signing. */}
      {quotation.status === 'shared' && (
        <QuotationShareLink
          clientId={clientId}
          quotationId={quotation._id}
          clientName={clientName}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
        />
      )}
    </div>
  )
}

export function QuotationsSection({
  clientId,
  clientName,
  contactEmail,
  contactPhone,
}: {
  clientId: string
  clientName: string
  contactEmail?: string
  contactPhone?: string
}) {
  const { data: quotations, isLoading } = useQuotations(clientId)
  const hasActiveQuotation = quotations?.some((q) => q.status !== 'superseded') ?? false

  return (
    <div className="space-y-6 bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Quotations</h2>
        <GenerateQuotationDialog clientId={clientId} hasActiveQuotation={hasActiveQuotation} />
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full bg-muted/40 rounded-xl" />
      ) : !quotations || quotations.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground">
          No quotation generated yet.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {quotations.map((quotation) => (
            <QuotationRow
              key={quotation._id}
              clientId={clientId}
              clientName={clientName}
              contactEmail={contactEmail}
              contactPhone={contactPhone}
              quotation={quotation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
