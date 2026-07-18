import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Download, Eye, FileSignature, FileText, Share2, Trash2, XCircle } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDeleteDocument, useEmployeeDocuments, useUploadSignedDocument } from '@/hooks/useDocuments'
import { useConfig } from '@/hooks/useConfig'
import {
  downloadGeneratedFile,
  downloadSignedFile,
  fetchGeneratedFileBlob,
  type GeneratedDocument,
} from '@/api/documents.api'
import { GeneratedFilePreviewDialog } from './GeneratedFilePreviewDialog'
import { ManualSendButtons } from '@/components/common/ManualSendButtons'
import { buildGmailComposeUrl, buildWhatsappUrl } from '@/lib/manualSend'

// One "notified" flag per document, backed by localStorage — used by both
// the row-level checkbox and the "Mark as notified" checkbox inside
// ManualSendButtons, so ticking either one updates the same value and both
// stay in sync (they're literally the same state, not two copies of it).
function useNotified(storageKey: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => localStorage.getItem(storageKey) === 'true')
  const set = (next: boolean) => {
    setValue(next)
    localStorage.setItem(storageKey, next ? 'true' : 'false')
  }
  return [value, set]
}

function DocumentRow({
  doc,
  employeeId,
  employeeName,
  employeeEmail,
  employeePhone,
  companyName,
  onDownload,
  onPreview,
  onDelete,
}: {
  doc: GeneratedDocument
  employeeId: string
  employeeName?: string
  employeeEmail?: string
  employeePhone?: string
  companyName: string
  onDownload: (documentId: string, filename: string) => void
  onPreview: (documentId: string, title: string) => void
  onDelete: (documentId: string) => void
}) {
  const [notified, setNotified] = useNotified(`notified_document_${doc._id}`)
  const uploadSigned = useUploadSignedDocument(employeeId)
  const file = doc.pdf ?? doc.docx
  const isPdf = file?.contentType === 'application/pdf'
  const emailBody = file
    ? `Hi ${employeeName ?? 'there'},\n\nPlease find your ${doc.template.title} attached to this email.\n\nThanks,\n${companyName} HR`
    : ''
  const whatsappText = file
    ? `Hi ${employeeName ?? 'there'}, please find your ${doc.template.title} attached.`
    : ''

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
          {file && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mr-1">
              <input
                type="checkbox"
                checked={notified}
                onChange={(e) => setNotified(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <span>Notified</span>
            </label>
          )}
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

      {file && (employeeEmail || employeePhone) && (
        <div className="border-t pt-2">
          <ManualSendButtons
            emailHref={
              employeeEmail
                ? buildGmailComposeUrl(employeeEmail, `${doc.template.title} — ${companyName}`, emailBody)
                : undefined
            }
            whatsappHref={employeePhone ? buildWhatsappUrl(employeePhone, whatsappText) : undefined}
            checked={notified}
            onCheckedChange={setNotified}
            onEmailClick={() => onDownload(doc._id, file.filename)}
            onWhatsappClick={() => onDownload(doc._id, file.filename)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The file downloads automatically — attach it before hitting send, mailto/WhatsApp links can't
            attach files themselves. "Share" uses your device's native share sheet instead, which can
            attach it directly where supported.
          </p>
        </div>
      )}
    </div>
  )
}

export function GeneratedDocumentsList({
  employeeId,
  employeeName,
  employeeEmail,
  employeePhone,
}: {
  employeeId: string
  employeeName?: string
  employeeEmail?: string
  employeePhone?: string
}) {
  const { data, isLoading } = useEmployeeDocuments(employeeId)
  const deleteDocument = useDeleteDocument(employeeId)
  const { data: config } = useConfig()
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const documents = data?.documents ?? []
  const companyName = config?.companyName ?? 'us'

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
              employeeName={employeeName}
              employeeEmail={employeeEmail}
              employeePhone={employeePhone}
              companyName={companyName}
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
