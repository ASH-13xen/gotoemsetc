import { useEffect, useRef, useState } from 'react'
import { pdfjsLib } from '@/lib/pdfjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PdfMarker {
  xPct: number
  yPct: number
  label: string
  colorClass: string
}

interface PdfPageCanvasProps {
  pdfUrl: string
  pageNumber: number // 1-indexed
  markers: PdfMarker[]
  onPick?: (xPct: number, yPct: number) => void
  pickCursor?: boolean
}

// Renders one page of a PDF to a canvas via pdf.js, with marker dots drawn
// as an absolutely-positioned overlay (so re-placing a marker never requires
// re-rendering the underlying page). Clicking anywhere reports the click
// position back as page-relative fractions (0-1) — the same coordinate
// space the backend stores and stamps against.
export function PdfPageCanvas({ pdfUrl, pageNumber, markers, onPick, pickCursor }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      if (!docRef.current) {
        docRef.current = await pdfjsLib.getDocument({ url: pdfUrl }).promise
      }
      const doc = docRef.current
      const page = await doc.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.4 })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      if (cancelled) return
      setSize({ width: viewport.width, height: viewport.height })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [pdfUrl, pageNumber])

  useEffect(() => {
    return () => {
      docRef.current?.cleanup()
      docRef.current = null
    }
  }, [pdfUrl])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onPick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = (e.clientX - rect.left) / rect.width
    const yPct = (e.clientY - rect.top) / rect.height
    onPick(xPct, yPct)
  }

  return (
    <div
      className={`relative inline-block border-2 border-white ${pickCursor ? 'cursor-crosshair' : ''}`}
      onClick={handleClick}
      style={size ? { width: size.width, height: size.height } : undefined}
    >
      <canvas ref={canvasRef} className="block max-w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold tracking-widest text-white uppercase">
          Rendering…
        </div>
      )}
      {markers.map((marker, i) => (
        <div
          key={i}
          className={`pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 ${marker.colorClass}`}
          style={{ left: `${marker.xPct * 100}%`, top: `${marker.yPct * 100}%` }}
        >
          <span className="size-3 rounded-full border-2 border-black bg-current" />
          <span className="border-2 border-black bg-current px-1.5 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap text-black uppercase">
            {marker.label}
          </span>
        </div>
      ))}
    </div>
  )
}
