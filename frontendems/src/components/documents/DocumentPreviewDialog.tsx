import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadUploadedDocument, fetchUploadedFileBlob } from '@/api/uploadRequests.api'
import type { UploadedDocument } from '@/api/uploadRequests.api'

interface DocumentPreviewDialogProps {
  doc: UploadedDocument | null
  label: string
  onClose: () => void
}

export function DocumentPreviewDialog({ doc, label, onClose }: DocumentPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!doc) {
      setUrl(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    setLoading(true)
    fetchUploadedFileBlob(doc._id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = window.URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [doc])

  if (!doc) return null

  const isImage = doc.mimeType?.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[90vh] w-[92vw] max-w-[92vw] flex-col gap-3 p-4 sm:max-w-[92vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span className="truncate">{label}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => downloadUploadedDocument(doc._id, doc.originalFilename ?? label)}
            >
              <Download className="size-3.5" />
              Download
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md border bg-muted/20">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !url ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Preview isn't available.
            </div>
          ) : isPdf ? (
            <iframe title={label} src={url} className="h-full w-full" />
          ) : isImage ? (
            <img src={url} alt={label} className="mx-auto h-full max-w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <p>Preview isn't available for this file type.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadUploadedDocument(doc._id, doc.originalFilename ?? label)}
              >
                Download instead
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
