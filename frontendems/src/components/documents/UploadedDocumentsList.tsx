import { toast } from 'sonner'
import { Download, FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfig } from '@/hooks/useConfig'
import { useDeleteUploadedDocument, useUploadedDocuments } from '@/hooks/useUploadRequests'

export function UploadedDocumentsList({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useUploadedDocuments(employeeId)
  const { data: config } = useConfig()
  const deleteDoc = useDeleteUploadedDocument(employeeId)

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
                <Button asChild variant="outline" size="sm">
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    <Download className="size-3.5" />
                    View
                  </a>
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
    </Card>
  )
}
