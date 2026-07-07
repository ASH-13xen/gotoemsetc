import { toast } from 'sonner'
import { CheckCircle2, Download, FileText, Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteDocument, useEmployeeDocuments } from '@/hooks/useDocuments'

export function GeneratedDocumentsList({ employeeId }: { employeeId: string }) {
  const { data, isLoading } = useEmployeeDocuments(employeeId)
  const deleteDocument = useDeleteDocument(employeeId)

  const documents = data?.documents ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generated documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : documents.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" />
            No documents generated yet.
          </p>
        ) : (
          documents.map((doc) => (
            <div key={doc._id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm">
                {doc.status === 'completed' ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span className="font-medium">{doc.template.title}</span>
                {doc.status === 'failed' && (
                  <span className="text-xs text-muted-foreground">{doc.errorMessage}</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {doc.docx && (
                  <Button asChild variant="outline" size="sm">
                    <a href={doc.docx.url} target="_blank" rel="noreferrer">
                      <Download className="size-3.5" />
                      docx
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    deleteDocument.mutate(doc._id, {
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
