import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Download, Eye, FileSignature, FileText, Share2, Trash2, XCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDeleteDocument, useEmployeeDocuments, useUploadSignedDocument } from '@/hooks/useDocuments'
import {
  downloadGeneratedFile,
  downloadSignedFile,
  fetchGeneratedFileBlob,
  type GeneratedDocument,
} from '@/api/documents.api'
import { GeneratedFilePreviewDialog } from './GeneratedFilePreviewDialog'

function DocumentRow({
  doc,
  employeeId,
  onDownload,
  onPreview,
  onDelete,
}: {
  doc: GeneratedDocument
  employeeId: string
  onDownload: (documentId: string, filename: string) => void
  onPreview: (documentId: string, title: string) => void
  onDelete: (documentId: string) => void
}) {
  const uploadSigned = useUploadSignedDocument(employeeId)
  const file = doc.pdf ?? doc.docx
  const isPdf = file?.contentType === 'application/pdf'

  const onShare = async () => {
    if (!file) return
    try {
      const blob = await fetchGeneratedFileBlob(doc._id)
      const shareFile = new File([blob], file.filename, { type: file.contentType })
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean
        share?: (data: { files: File[]; title?: string }) => Promise<void>
      }
      if (nav.canShare?.({ files: [shareFile] }) && nav.share) {
        await nav.share({ files: [shareFile], title: doc.template.title })
        return
      }
      toast.info("Sharing isn't supported in this browser — downloaded instead")
      await onDownload(doc._id, file.filename)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') toast.error('Could not share the file')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
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
          {file && isPdf && (
            <Button variant="outline" size="sm" onClick={() => onPreview(doc._id, doc.template.title)}>
              <Eye className="size-3.5" />
              Preview
            </Button>
          )}
          {file && (
            <Button variant="outline" size="sm" onClick={() => onShare()}>
              <Share2 className="size-3.5" />
              Share
            </Button>
          )}
          {file && (
            <Button variant="outline" size="sm" onClick={() => onDownload(doc._id, file.filename)}>
              <Download className="size-3.5" />
              Download
            </Button>
          )}
          <label
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              uploadSigned.isPending ? 'pointer-events-none opacity-50' : 'cursor-pointer'
            )}
          >
            <FileSignature className="size-3.5" />
            Upload Signed PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploadSigned.isPending}
              onChange={(e) => {
                const selected = e.target.files?.[0]
                e.target.value = ''
                if (!selected) return
                uploadSigned.mutate(
                  { documentId: doc._id, file: selected },
                  {
                    onSuccess: () => toast.success('Signed copy uploaded'),
                    onError: () => toast.error('Could not upload the signed copy'),
                  }
                )
              }}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => onDelete(doc._id)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {doc.signedFile && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <FileSignature className="size-3.5" />
            Signed copy on file
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadSignedFile(doc._id, doc.signedFile!.filename).catch(() => toast.error('Could not download the signed copy'))}
          >
            <Download className="size-3.5" />
            Download
          </Button>
        </div>
      )}
    </div>
  )
}

export function GeneratedDocumentsList({
  employeeId,
}: {
  employeeId: string
}) {
  const { data, isLoading } = useEmployeeDocuments(employeeId)
  const deleteDocument = useDeleteDocument(employeeId)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const documents = data?.documents ?? []

  const onDownload = async (documentId: string, filename: string) => {
    try {
      await downloadGeneratedFile(documentId, filename)
    } catch {
      toast.error('Could not download the file')
    }
  }

  const onPreview = (documentId: string, title: string) => {
    setPreviewDocId(documentId)
    setPreviewTitle(title)
  }

  const onDelete = (documentId: string) => {
    deleteDocument.mutate(documentId, {
      onSuccess: () => toast.success('Document removed'),
      onError: () => toast.error('Could not remove document'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generated documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : documents.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" />
            No documents generated yet.
          </p>
        ) : (
          documents.map((doc) => (
            <DocumentRow
              key={doc._id}
              doc={doc}
              employeeId={employeeId}
              onDownload={onDownload}
              onPreview={onPreview}
              onDelete={onDelete}
            />
          ))
        )}
      </CardContent>
      <GeneratedFilePreviewDialog documentId={previewDocId} title={previewTitle} onClose={() => setPreviewDocId(null)} />
    </Card>
  )
}
