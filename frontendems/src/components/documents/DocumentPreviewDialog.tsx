import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { UploadedDocument } from '@/api/uploadRequests.api'

interface DocumentPreviewDialogProps {
  doc: UploadedDocument | null
  label: string
  onClose: () => void
}

export function DocumentPreviewDialog({ doc, label, onClose }: DocumentPreviewDialogProps) {
  if (!doc) return null

  const isImage = doc.mimeType?.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[90vh] w-[92vw] max-w-[92vw] flex-col gap-3 p-4 sm:max-w-[92vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span className="truncate">{label}</span>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <a href={doc.url} target="_blank" rel="noreferrer" download={doc.originalFilename}>
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md border bg-muted/20">
          {isPdf ? (
            <iframe title={label} src={doc.url} className="h-full w-full" />
          ) : isImage ? (
            <img src={doc.url} alt={label} className="mx-auto h-full max-w-full object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <p>Preview isn't available for this file type.</p>
              <Button asChild variant="outline" size="sm">
                <a href={doc.url} target="_blank" rel="noreferrer">
                  Open in a new tab
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
