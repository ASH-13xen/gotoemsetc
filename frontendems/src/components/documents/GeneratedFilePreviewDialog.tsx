import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fetchGeneratedFileBlob } from '@/api/documents.api'

interface GeneratedFilePreviewDialogProps {
  documentId: string | null
  title: string
  onClose: () => void
}

export function GeneratedFilePreviewDialog({ documentId, title, onClose }: GeneratedFilePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!documentId) {
      setUrl(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    setLoading(true)
    fetchGeneratedFileBlob(documentId)
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
  }, [documentId])

  return (
    <Dialog open={Boolean(documentId)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[90vh] w-[92vw] max-w-[92vw] flex-col gap-3 p-4 sm:max-w-[92vw]">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md border bg-muted/20">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <iframe title={title} src={url} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Preview isn't available.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
