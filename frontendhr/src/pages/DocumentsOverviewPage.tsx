import { toast } from 'sonner'
import { CheckCircle2, Circle, Eye, FileCheck2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveTemplates, useDocumentsOverview } from '@/hooks/useDocuments'
import { previewGeneratedFile, previewSignedFile } from '@/api/documents.api'
import type { DocumentOverviewRow } from '@/api/documents.api'
import { useState } from 'react'

function Column({
  title,
  icon,
  rows,
  emptyLabel,
  onPreview,
  onPreviewSigned,
}: {
  title: string
  icon: React.ReactNode
  rows: DocumentOverviewRow[]
  emptyLabel: string
  onPreview?: (row: DocumentOverviewRow) => void
  onPreviewSigned?: (row: DocumentOverviewRow) => void
}) {
  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>
            {title} ({rows.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 px-0 pb-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.employeeId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{row.employeeName}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.employeeCode}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {onPreview && (
                  <Button size="sm" variant="outline" onClick={() => onPreview(row)}>
                    <Eye className="size-3.5" />
                  </Button>
                )}
                {onPreviewSigned && (
                  <Button size="sm" variant="outline" onClick={() => onPreviewSigned(row)}>
                    <FileCheck2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default function DocumentsOverviewPage() {
  const { data: templatesData, isLoading: templatesLoading } = useActiveTemplates()
  const templates = templatesData?.templates ?? []
  const [templateKey, setTemplateKey] = useState<string | undefined>(undefined)
  const { data, isLoading } = useDocumentsOverview(templateKey)

  const rows = data?.rows ?? []
  const generatedAndSigned = rows.filter((r) => r.bucket === 'generated_and_signed')
  const generated = rows.filter((r) => r.bucket === 'generated')
  const notGenerated = rows.filter((r) => r.bucket === 'not_generated')

  const onPreview = (row: DocumentOverviewRow) => {
    if (!row.documentId) return
    previewGeneratedFile(row.documentId).catch(() => toast.error('Could not open document'))
  }
  const onPreviewSigned = (row: DocumentOverviewRow) => {
    if (!row.documentId) return
    previewSignedFile(row.documentId).catch(() => toast.error('Could not open signed copy'))
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 py-8">
      <PageHeader
        eyebrow="HR Work"
        title="Generated documents"
        description="Pick a document template to see who has it generated, generated and signed, or not generated at all."
        actions={
          templatesLoading ? (
            <Skeleton className="h-12 w-56" />
          ) : (
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a document template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      {!templateKey ? (
        <p className="text-sm text-muted-foreground">Select a template above to see its status across all employees.</p>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Column
            title="Generated + Signed"
            icon={<CheckCircle2 className="size-4 text-emerald-600" />}
            rows={generatedAndSigned}
            emptyLabel="No signed copies yet."
            onPreview={onPreview}
            onPreviewSigned={onPreviewSigned}
          />
          <Column
            title="Generated"
            icon={<FileCheck2 className="size-4 text-primary" />}
            rows={generated}
            emptyLabel="None waiting on a signature."
            onPreview={onPreview}
          />
          <Column
            title="Not Generated"
            icon={<Circle className="size-4 text-muted-foreground" />}
            rows={notGenerated}
            emptyLabel="Everyone has this document."
          />
        </div>
      )}
    </div>
  )
}
