import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PdfPageCanvas } from '@/components/quotationTemplates/PdfPageCanvas'
import type { PdfBox, PdfFieldBox } from '@/components/quotationTemplates/PdfPageCanvas'
import { quotationTemplatePdfUrl } from '@/api/quotationTemplates.api'
import type { QuotationTemplateFields } from '@/api/quotationTemplates.api'
import { useQuotationTemplate, useUpdateQuotationTemplateFields } from '@/hooks/useQuotationTemplates'
import { getFieldPosition, getMapperFields, setFieldPosition } from '@/lib/quotationFields'

export default function QuotationTemplateMapperPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: template, isLoading } = useQuotationTemplate(id)
  const updateFields = useUpdateQuotationTemplateFields(id ?? '')

  const [fields, setFields] = useState<QuotationTemplateFields>({})
  const [initialized, setInitialized] = useState(false)
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (template && !initialized) {
      setFields(template.fields ?? {})
      setInitialized(true)
    }
  }, [template, initialized])

  if (isLoading || !template) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-32 w-full bg-neutral-800" />
        <Skeleton className="h-[600px] w-full bg-neutral-800" />
      </div>
    )
  }

  const mapperFields = getMapperFields(template)
  const pdfUrl = quotationTemplatePdfUrl(template._id)

  const boxesForPage: PdfFieldBox[] = mapperFields
    .map((field) => {
      const position = getFieldPosition(fields, field.key)
      if (!position || position.page !== currentPage - 1) return null
      return {
        key: field.key,
        xPct: position.xPct,
        yPct: position.yPct,
        widthPct: position.widthPct,
        heightPct: position.heightPct,
        label: field.label,
        colorClass: field.colorClass,
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  const handleCommit = (box: PdfBox) => {
    if (!activeFieldKey) return
    const isFirstPlacement = !getFieldPosition(fields, activeFieldKey)
    const nextFields = setFieldPosition(
      fields,
      activeFieldKey,
      { page: currentPage - 1, ...box },
      template.planOptions.length
    )
    setFields(nextFields)

    // Auto-advance only right after drawing a brand new box — once it
    // exists, keep it active so the admin can keep dragging/resizing it
    // without being bounced to the next field on every adjustment.
    if (isFirstPlacement) {
      const currentIndex = mapperFields.findIndex((f) => f.key === activeFieldKey)
      const nextUnplaced = mapperFields.slice(currentIndex + 1).find((f) => !getFieldPosition(nextFields, f.key))
      setActiveFieldKey(nextUnplaced?.key ?? null)
    }
  }

  const handleSave = () => {
    updateFields.mutate(fields, {
      onSuccess: (updated) => {
        toast.success(updated.isConfigured ? 'Template fully calibrated and ready to use' : 'Positions saved — some fields are still unplaced')
      },
      onError: () => toast.error('Could not save field positions'),
    })
  }

  const allPlaced = mapperFields.every((f) => Boolean(getFieldPosition(fields, f.key)))

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <main className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div>
            <button
              onClick={() => navigate('/quotation-templates')}
              className="text-xs font-bold tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Templates
            </button>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{template.title}</h1>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:opacity-95"
            onClick={handleSave}
            disabled={updateFields.isPending}
          >
            {updateFields.isPending && <Loader2 className="size-4 animate-spin" />}
            {allPlaced ? 'Save Calibration' : 'Save Progress'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* FIELD LIST */}
          <div className="space-y-2 bg-card border border-border rounded-xl p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
              Click a field, then drag on the PDF to draw its box
            </p>
            {mapperFields.map((field) => {
              const position = getFieldPosition(fields, field.key)
              const isActive = activeFieldKey === field.key
              return (
                <button
                  key={field.key}
                  onClick={() => setActiveFieldKey(field.key)}
                  className={`flex w-full items-center justify-between gap-2 border p-3 rounded-lg text-left transition-all ${
                    isActive ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card hover:bg-secondary/40'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <MapPin className={`size-3.5 shrink-0 ${field.colorClass}`} />
                    {field.label}
                  </span>
                  {position && (
                    <span className="shrink-0 text-[10px] font-bold tracking-wider text-muted-foreground">
                      p{position.page + 1}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* PDF VIEWER */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3 shadow-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                PREV
              </Button>
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Page {currentPage} of {template.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= template.pageCount}
                onClick={() => setCurrentPage((p) => Math.min(template.pageCount, p + 1))}
              >
                NEXT
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="overflow-auto border border-border rounded-xl bg-white p-2">
              <PdfPageCanvas
                pdfUrl={pdfUrl}
                pageNumber={currentPage}
                boxes={boxesForPage}
                activeKey={activeFieldKey}
                onCommit={handleCommit}
              />
            </div>
            {activeFieldKey && (
              <p className="border border-primary bg-primary/10 p-3 rounded-lg text-xs font-semibold text-foreground">
                {getFieldPosition(fields, activeFieldKey)
                  ? `Drag the box or its corner handle to adjust: ${mapperFields.find((f) => f.key === activeFieldKey)?.label}`
                  : `Drag on the PDF above to draw a box for: ${mapperFields.find((f) => f.key === activeFieldKey)?.label}`}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
