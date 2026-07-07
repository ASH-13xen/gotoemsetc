import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PdfPageCanvas } from '@/components/quotationTemplates/PdfPageCanvas'
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

  const markersForPage = mapperFields
    .map((field) => {
      const position = getFieldPosition(fields, field.key)
      if (!position || position.page !== currentPage - 1) return null
      return { xPct: position.xPct, yPct: position.yPct, label: field.label, colorClass: field.colorClass }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const handlePick = (xPct: number, yPct: number) => {
    if (!activeFieldKey) return
    const nextFields = setFieldPosition(fields, activeFieldKey, { page: currentPage - 1, xPct, yPct }, template.planOptions.length)
    setFields(nextFields)

    const currentIndex = mapperFields.findIndex((f) => f.key === activeFieldKey)
    const nextUnplaced = mapperFields.slice(currentIndex + 1).find((f) => !getFieldPosition(nextFields, f.key))
    setActiveFieldKey(nextUnplaced?.key ?? null)
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
    <div className="min-h-screen bg-black p-6 text-white">
      <main className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-white bg-black p-6">
          <div>
            <button
              onClick={() => navigate('/quotation-templates')}
              className="text-xs font-black tracking-widest text-neutral-500 uppercase hover:text-white"
            >
              ← Back to Templates
            </button>
            <h1 className="mt-1 text-3xl font-black tracking-tighter text-white uppercase">{template.title}</h1>
          </div>
          <Button
            className="bg-primary text-white hover:opacity-90"
            onClick={handleSave}
            disabled={updateFields.isPending}
          >
            {updateFields.isPending && <Loader2 className="size-4 animate-spin" />}
            {allPlaced ? 'Save Calibration' : 'Save Progress'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* FIELD LIST */}
          <div className="space-y-2 border-2 border-white bg-black p-4">
            <p className="mb-2 text-xs font-black tracking-widest text-neutral-400 uppercase">
              Click a field, then click its spot on the PDF
            </p>
            {mapperFields.map((field) => {
              const position = getFieldPosition(fields, field.key)
              const isActive = activeFieldKey === field.key
              return (
                <button
                  key={field.key}
                  onClick={() => setActiveFieldKey(field.key)}
                  className={`flex w-full items-center justify-between gap-2 border-2 p-3 text-left transition-colors ${
                    isActive ? 'border-primary bg-primary/20' : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-white uppercase">
                    <MapPin className={`size-3.5 shrink-0 ${field.colorClass}`} />
                    {field.label}
                  </span>
                  {position && (
                    <span className="shrink-0 text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                      p{position.page + 1}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* PDF VIEWER */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-2 border-white bg-black p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                PREV
              </Button>
              <span className="text-xs font-black tracking-widest text-white uppercase">
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
            <div className="overflow-auto">
              <PdfPageCanvas
                pdfUrl={pdfUrl}
                pageNumber={currentPage}
                markers={markersForPage}
                onPick={handlePick}
                pickCursor={Boolean(activeFieldKey)}
              />
            </div>
            {activeFieldKey && (
              <p className="border-2 border-primary bg-primary/10 p-3 text-xs font-bold tracking-widest text-white uppercase">
                Click on the PDF above to place: {mapperFields.find((f) => f.key === activeFieldKey)?.label}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
