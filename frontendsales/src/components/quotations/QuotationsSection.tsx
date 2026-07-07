import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerateQuotationDialog } from './GenerateQuotationDialog'
import { AdminSignDialog } from './AdminSignDialog'
import { useQuotations } from '@/hooks/useQuotations'
import { quotationFileUrl } from '@/api/quotations.api'
import type { Quotation, QuotationStatus } from '@/api/quotations.api'

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: 'border-neutral-500 bg-neutral-900 text-neutral-300',
  shared: 'border-sky-500 bg-sky-950/40 text-sky-400',
  signed: 'border-emerald-500 bg-emerald-950/40 text-emerald-400',
  superseded: 'border-neutral-700 bg-neutral-950 text-neutral-600',
}

function planLabel(quotation: Quotation) {
  if (!quotation.planOptionKey) return null
  return (
    quotation.template?.planOptions?.find((o) => o.key === quotation.planOptionKey)?.label ?? quotation.planOptionKey
  )
}

function QuotationRow({ clientId, quotation }: { clientId: string; quotation: Quotation }) {
  const label = planLabel(quotation)
  const downloadVariant = quotation.finalSignedFile ? 'final' : quotation.adminSignedFile ? 'admin-signed' : 'draft'

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0 ${quotation.status === 'superseded' ? 'opacity-50' : ''}`}>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black tracking-wide text-white uppercase">
            v{quotation.version} — {quotation.template.title}
          </span>
          <span className={`border-2 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${STATUS_STYLES[quotation.status]}`}>
            {quotation.status}
          </span>
        </div>
        <p className="mt-1 text-xs font-bold tracking-widest text-neutral-500 uppercase">
          {label ? `${label} · ` : ''}
          {new Date(quotation.createdAt).toLocaleDateString()}
          {quotation.signedAt ? ` · Signed ${new Date(quotation.signedAt).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={quotationFileUrl(quotation._id, downloadVariant)} target="_blank" rel="noreferrer">
            <Download className="size-3.5" />
            {quotation.status === 'signed' ? 'FINAL PDF' : 'PREVIEW'}
          </a>
        </Button>
        {quotation.status === 'draft' && <AdminSignDialog clientId={clientId} quotationId={quotation._id} />}
      </div>
    </div>
  )
}

export function QuotationsSection({ clientId }: { clientId: string }) {
  const { data: quotations, isLoading } = useQuotations(clientId)
  const hasActiveQuotation = quotations?.some((q) => q.status !== 'superseded') ?? false

  return (
    <div className="space-y-6 border-2 border-white bg-black p-6">
      <div className="flex items-center justify-between border-b-2 border-white pb-3">
        <h2 className="text-2xl font-black tracking-widest text-white uppercase">Quotations</h2>
        <GenerateQuotationDialog clientId={clientId} hasActiveQuotation={hasActiveQuotation} />
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full bg-neutral-800" />
      ) : !quotations || quotations.length === 0 ? (
        <p className="text-sm font-bold tracking-widest text-neutral-400 uppercase">
          No quotation generated yet.
        </p>
      ) : (
        <div className="divide-y-2 divide-neutral-900">
          {quotations.map((quotation) => (
            <QuotationRow key={quotation._id} clientId={clientId} quotation={quotation} />
          ))}
        </div>
      )}
    </div>
  )
}
