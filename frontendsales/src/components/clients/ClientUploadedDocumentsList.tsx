import { toast } from 'sonner'
import { Download, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClientUploadedDocuments, useDeleteUploadedDocument } from '@/hooks/useClientDocumentRequests'
import { downloadUploadedDocument } from '@/api/clientDocumentRequests.api'

export function ClientUploadedDocumentsList({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientUploadedDocuments(clientId)
  const deleteDoc = useDeleteUploadedDocument(clientId)
  const documents = data?.documents ?? []

  const onDownload = async (id: string, docLabel: string, originalFilename?: string) => {
    try {
      await downloadUploadedDocument(id, originalFilename || `${docLabel}.pdf`)
    } catch {
      toast.error('Could not download the file')
    }
  }

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
            <FileText className="size-4" />
            No documents uploaded yet.
          </p>
        ) : (
          documents.map((doc) => (
            <div key={doc._id} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/30 p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{doc.docLabel}</p>
                <p className="text-xs text-muted-foreground">{doc.originalFilename}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownload(doc._id, doc.docLabel, doc.originalFilename)}
                >
                  <Download className="size-3.5" />
                  Download
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
