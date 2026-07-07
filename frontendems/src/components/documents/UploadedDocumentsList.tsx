import { useState } from 'react'
import { toast } from 'sonner'
import { Eye, FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfig } from '@/hooks/useConfig'
import { useDeleteUploadedDocument, useUploadedDocuments } from '@/hooks/useUploadRequests'
import { DocumentPreviewDialog } from '@/components/documents/DocumentPreviewDialog'
import type { UploadedDocument } from '@/api/uploadRequests.api'

export function UploadedDocumentsList({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useUploadedDocuments(employeeId)
  const { data: config } = useConfig()
  const deleteDoc = useDeleteUploadedDocument(employeeId)
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null)

  const documents = data?.uploadedDocuments ?? []
  const labelFor = (key: string) => config?.docTypes.find((d) => d.key === key)?.label ?? key

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Uploaded documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : documents.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="size-4" />
            No documents uploaded yet.
          </p>
        ) : (
          documents.map((doc) => (
            <div key={doc._id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-sm font-medium">{labelFor(doc.docType)}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewDoc(doc)}>
                  <Eye className="size-3.5" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    deleteDoc.mutate(doc._id, {
                      onSuccess: () => toast.success('Document removed'),
                      onError: () => toast.error('Could not remove document'),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <DocumentPreviewDialog
        doc={previewDoc}
        label={previewDoc ? labelFor(previewDoc.docType) : ''}
        onClose={() => setPreviewDoc(null)}
      />
    </Card>
  )
}
