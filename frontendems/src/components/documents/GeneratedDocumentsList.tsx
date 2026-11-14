import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Download, Eye, FileSignature, FileText, PenTool, Send, Share2, Trash2, XCircle } from 'lucide-react'
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
import { CompanySignaturesDialog, SendDialog, SignatureStrip, latestByDocument, useSignatures } from './ESign'
import { ISSUE_ONLY, type DocumentSignature } from '@/api/esign.api'
import { useAuth } from '@/hooks/useAuth'
import { isAdminLike } from '@/lib/permissions'
import { extractApiErrorMessage } from '@/lib/errors'

function DocumentRow({
  doc,
  employeeId,
  onDownload,
  onPreview,
  onDelete,
  signature,
}: {
  doc: GeneratedDocument
  employeeId: string
  // The latest e-signing of this document, if it was sent.
  signature?: DocumentSignature
  onDownload: (documentId: string, filename: string) => void
  onPreview: (documentId: string, title: string) => void
  onDelete: (documentId: string) => void
}) {
  const uploadSigned = useUploadSignedDocument(employeeId)
  const [sending, setSending] = useState(false)
  const file = doc.pdf ?? doc.docx
  // Out for signing, signed or issued electronically: kept as it is.
  const esignLive = Boolean(signature && ['sent', 'viewed', 'signed', 'issued'].includes(signature.status))
  const canSend = doc.status === 'completed' && Boolean(file) && !doc.signedFile && !esignLive
  const issue = ISSUE_ONLY.includes(doc.template.key)
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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
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
        <div className="flex flex-wrap items-center gap-2">
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
          {canSend && (
            <Button size="sm" onClick={() => setSending(true)}>
              {issue ? <Send className="size-3.5" /> : <PenTool className="size-3.5" />}
              {issue ? 'Send' : 'Send to sign'}
            </Button>
          )}
          {!esignLive && (
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
          )}
          {!esignLive && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(doc._id)}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {signature && <SignatureStrip s={signature} employeeId={employeeId} canManage />}
      {sending && <SendDialog employeeId={employeeId} documentId={doc._id} templateKey={doc.template.key} title={doc.template.title} open onOpenChange={setSending} />}

      {/* A paper copy uploaded by HR (an e-signed or issued copy shows in its own strip above). */}
      {doc.signedFile && !(signature && (signature.status === 'signed' || signature.status === 'issued')) && (
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
  const { user } = useAuth()
  const { data: signatures } = useSignatures(employeeId)
  const latest = latestByDocument(signatures)
  const [signaturesOpen, setSignaturesOpen] = useState(false)
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
      onError: (err) => toast.error(extractApiErrorMessage(err, 'Could not remove document')),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generated documents</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isAdminLike(user) && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setSignaturesOpen(true)}>
              <FileSignature className="size-3.5" />
              Company signatures
            </Button>
          </div>
        )}
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
              signature={latest.get(doc._id)}
            />
          ))
        )}
      </CardContent>
      <GeneratedFilePreviewDialog documentId={previewDocId} title={previewTitle} onClose={() => setPreviewDocId(null)} />
      {signaturesOpen && <CompanySignaturesDialog open onOpenChange={setSignaturesOpen} />}
    </Card>
  )
}
