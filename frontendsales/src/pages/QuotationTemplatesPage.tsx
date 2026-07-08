import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CircleAlert, FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useQuotationTemplates } from '@/hooks/useQuotationTemplates'

export default function QuotationTemplatesPage() {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useQuotationTemplates()

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-6xl space-y-8">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Admin Setup</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Quotation Templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each of these 8 PDFs has a genuinely different layout. Calibrate where client name, brand
            name, plan checkboxes, and signatures land on each one before it can be used to generate a
            real quotation.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-muted/40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templates?.map((template) => (
              <div
                key={template._id}
                onClick={() => navigate(`/quotation-templates/${template._id}`)}
                className="flex cursor-pointer items-start justify-between gap-3 bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow hover:bg-secondary/40 transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-lg font-bold tracking-wide text-foreground">{template.title}</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {template.companyLabel} · {template.pageCount} page{template.pageCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {template.isConfigured ? (
                  <Badge variant="success" className="shrink-0">
                    <CheckCircle2 className="size-3.5" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="warning" className="shrink-0">
                    <CircleAlert className="size-3.5" />
                    Needs Setup
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
