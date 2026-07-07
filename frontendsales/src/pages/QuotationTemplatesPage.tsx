import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleAlert, FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuotationTemplates } from '@/hooks/useQuotationTemplates'

export default function QuotationTemplatesPage() {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useQuotationTemplates()

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-6xl space-y-8">
        <div className="border-2 border-white bg-black p-8">
          <span className="text-xs font-black tracking-widest text-neutral-400 uppercase">Admin Setup</span>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase md:text-6xl">
            Quotation Templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-bold tracking-wide text-neutral-400 uppercase">
            Each of these 8 PDFs has a genuinely different layout. Calibrate where client name, brand
            name, plan checkboxes, and signatures land on each one before it can be used to generate a
            real quotation.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-neutral-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templates?.map((template) => (
              <div
                key={template._id}
                onClick={() => navigate(`/quotation-templates/${template._id}`)}
                className="flex cursor-pointer items-start justify-between gap-3 border-2 border-white bg-black p-6 transition-colors hover:bg-neutral-900"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 size-5 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-lg font-black tracking-wide text-white uppercase">{template.title}</p>
                    <p className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
                      {template.companyLabel} · {template.pageCount} page{template.pageCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {template.isConfigured ? (
                  <span className="inline-flex shrink-0 items-center gap-1 border-2 border-emerald-500 bg-emerald-950/40 px-2 py-1 text-xs font-bold tracking-widest text-emerald-400 uppercase">
                    <CheckCircle2 className="size-3.5" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 border-2 border-amber-500 bg-amber-950/40 px-2 py-1 text-xs font-bold tracking-widest text-amber-400 uppercase">
                    <CircleAlert className="size-3.5" />
                    Needs Setup
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
