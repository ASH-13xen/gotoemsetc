import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Download, Eye, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GeneratedFilePreviewDialog } from '@/components/documents/GeneratedFilePreviewDialog'
import { downloadGeneratedFile } from '@/api/documents.api'
import type { DocumentTemplate } from '@/api/templates.api'
import type { GenerateResult } from '@/api/documents.api'
import type { SalaryComponent } from '@/api/employees.api'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

interface ReviewGenerateStepProps {
  templates: DocumentTemplate[]
  fieldValues: Record<string, string>
  onGenerate: () => void
  isGenerating: boolean
  results: GenerateResult[] | null
  salaryComponents?: SalaryComponent[]
  responsibilities?: string[]
}

export function ReviewGenerateStep({
  templates,
  fieldValues,
  onGenerate,
  isGenerating,
  results,
  salaryComponents,
  responsibilities,
}: ReviewGenerateStepProps) {
  const monthlyGross = (salaryComponents ?? []).reduce((sum, c) => sum + (Number(c.monthlyAmount) || 0), 0)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const onDownload = async (documentId: string, filename: string) => {
    try {
      await downloadGeneratedFile(documentId, filename)
    } catch {
      toast.error('Could not download the file')
    }
  }

  return (
    <div className="grid gap-4">
      {salaryComponents && salaryComponents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salary structure</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {salaryComponents.map((c, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-medium">{formatCurrency(c.monthlyAmount)} / month</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-medium">
              <span>Annual CTC</span>
              <span>{formatCurrency(monthlyGross * 12)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {responsibilities && responsibilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {responsibilities.map((r, i) => (
              <div key={i} className="text-muted-foreground">
                • {r}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {templates.map((template) => (
        <Card key={template._id}>
          <CardHeader>
            <CardTitle className="text-base">{template.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {template.fields
              .filter((f) => f.source !== 'computed')
              .map((field) => (
                <div key={field.key} className="flex items-baseline justify-between gap-4">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="truncate font-medium">
                    {fieldValues[field.key] || <span className="text-muted-foreground">—</span>}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {results.map((result) => {
              const file = result.document?.pdf ?? result.document?.docx
              const isPdf = file?.contentType === 'application/pdf'
              return (
                <div key={result.templateId} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-sm">
                    {result.status === 'completed' ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <XCircle className="size-4 text-destructive" />
                    )}
                    {result.templateKey ?? result.templateId}
                    {result.status === 'failed' && (
                      <span className="text-xs text-muted-foreground">{result.error}</span>
                    )}
                  </span>
                  {result.status === 'completed' && file && result.document && (
                    <div className="flex items-center gap-2">
                      {isPdf && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreviewDocId(result.document!._id)
                            setPreviewTitle(result.templateKey ?? result.templateId)
                          }}
                        >
                          <Eye className="size-3.5" />
                          Preview
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownload(result.document!._id, file.filename)}
                      >
                        <Download className="size-3.5" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {(!results || results.length === 0) ? (
        <div className="flex justify-end">
          <Button onClick={onGenerate} disabled={isGenerating}>
            {isGenerating && <Loader2 className="size-4 animate-spin" />}
            Generate documents
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating && <Loader2 className="size-4 animate-spin" />}
            Regenerate documents
          </Button>
        </div>
      )}

      <GeneratedFilePreviewDialog documentId={previewDocId} title={previewTitle} onClose={() => setPreviewDocId(null)} />
    </div>
  )
}
