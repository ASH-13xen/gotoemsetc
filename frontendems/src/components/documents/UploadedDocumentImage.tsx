import { useEffect, useState } from 'react'
import { fetchUploadedFileBlob } from '@/api/uploadRequests.api'

// Uploaded documents are served through an authenticated route, not a
// direct URL (see DocumentPreviewDialog) — so rendering one as a plain <img>
// needs the same blob-fetch-then-object-URL dance, not a bare `src`.
export function UploadedDocumentImage({
  documentId,
  alt,
  className,
}: {
  documentId: string
  alt: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    fetchUploadedFileBlob(documentId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = window.URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [documentId])

  if (!url) return null
  return <img src={url} alt={alt} className={className} />
}
