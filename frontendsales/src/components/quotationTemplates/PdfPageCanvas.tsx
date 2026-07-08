import { useEffect, useRef, useState } from 'react'
import { pdfjsLib } from '@/lib/pdfjs'
import { getToken } from '@/lib/authStorage'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PdfBox {
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
}

export interface PdfFieldBox extends PdfBox {
  key: string
  label: string
  colorClass: string
}

interface PdfPageCanvasProps {
  pdfUrl: string
  pageNumber: number // 1-indexed
  boxes: PdfFieldBox[]
  activeKey?: string | null
  onCommit?: (box: PdfBox) => void
}

const MIN_BOX_PCT = 0.015

type DragMode = 'none' | 'creating' | 'moving' | 'resizing'

interface DragState {
  mode: DragMode
  // Pixel-space anchor the drag started from.
  startX: number
  startY: number
  // For move/resize: the box (in pixel space) as it was when the drag started.
  originBox: { x: number; y: number; width: number; height: number }
}

// Renders one page of a PDF to a canvas via pdf.js, with each calibrated
// field drawn as an actual bordered box overlay (sized to match what will
// be stamped) rather than a floating pin. The field currently being edited
// can be drawn fresh by dragging on the page, or moved/resized via its
// handle once placed — everything else renders read-only.
export function PdfPageCanvas({ pdfUrl, pageNumber, boxes, activeKey, onCommit }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [previewPx, setPreviewPx] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      if (!docRef.current) {
        // pdf.js fetches this URL directly (not through the axios instance),
        // so the auth token has to be attached here explicitly — this route
        // requires a valid session like any other API endpoint.
        const token = getToken()
        docRef.current = await pdfjsLib.getDocument({
          url: pdfUrl,
          httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).promise
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

  const activeBox = activeKey ? boxes.find((b) => b.key === activeKey) : undefined

  function toPx(box: PdfBox) {
    if (!size) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: box.xPct * size.width,
      y: box.yPct * size.height,
      width: box.widthPct * size.width,
      height: box.heightPct * size.height,
    }
  }

  function toPct(px: { x: number; y: number; width: number; height: number }): PdfBox {
    if (!size) return { xPct: 0, yPct: 0, widthPct: MIN_BOX_PCT, heightPct: MIN_BOX_PCT }
    return {
      xPct: px.x / size.width,
      yPct: px.y / size.height,
      widthPct: px.width / size.width,
      heightPct: px.height / size.height,
    }
  }

  function clientToLocal(e: MouseEvent | React.MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startCreate = (e: React.MouseEvent) => {
    if (!onCommit || !activeKey || !size) return
    // If the active field already has a box on this page, clicking its body
    // starts a move instead — handled by handleBoxMouseDown below.
    const { x, y } = clientToLocal(e)
    setDrag({ mode: 'creating', startX: x, startY: y, originBox: { x, y, width: 0, height: 0 } })
    setPreviewPx({ x, y, width: 0, height: 0 })
  }

  const handleBoxMouseDown = (e: React.MouseEvent) => {
    if (!onCommit || !activeBox || !size) return
    e.stopPropagation()
    const { x, y } = clientToLocal(e)
    const originBox = toPx(activeBox)
    setDrag({ mode: 'moving', startX: x, startY: y, originBox })
    setPreviewPx(originBox)
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!onCommit || !activeBox || !size) return
    e.stopPropagation()
    const { x, y } = clientToLocal(e)
    const originBox = toPx(activeBox)
    setDrag({ mode: 'resizing', startX: x, startY: y, originBox })
    setPreviewPx(originBox)
  }

  useEffect(() => {
    if (!drag || !size) return

    const onMove = (e: MouseEvent) => {
      const { x, y } = clientToLocal(e)
      const dx = x - drag.startX
      const dy = y - drag.startY

      if (drag.mode === 'creating') {
        const boxX = Math.min(drag.startX, x)
        const boxY = Math.min(drag.startY, y)
        const width = Math.abs(dx)
        const height = Math.abs(dy)
        setPreviewPx({ x: boxX, y: boxY, width, height })
      } else if (drag.mode === 'moving') {
        const maxX = size.width - drag.originBox.width
        const maxY = size.height - drag.originBox.height
        const nx = Math.min(Math.max(0, drag.originBox.x + dx), Math.max(0, maxX))
        const ny = Math.min(Math.max(0, drag.originBox.y + dy), Math.max(0, maxY))
        setPreviewPx({ x: nx, y: ny, width: drag.originBox.width, height: drag.originBox.height })
      } else if (drag.mode === 'resizing') {
        const minPx = MIN_BOX_PCT * Math.min(size.width, size.height)
        const width = Math.max(minPx, Math.min(drag.originBox.width + dx, size.width - drag.originBox.x))
        const height = Math.max(minPx, Math.min(drag.originBox.height + dy, size.height - drag.originBox.y))
        setPreviewPx({ x: drag.originBox.x, y: drag.originBox.y, width, height })
      }
    }

    const onUp = () => {
      if (previewPx && onCommit) {
        const minPx = MIN_BOX_PCT * Math.min(size.width, size.height)
        if (drag.mode !== 'creating' || (previewPx.width >= minPx && previewPx.height >= minPx)) {
          const finalPx =
            previewPx.width < minPx || previewPx.height < minPx
              ? { ...previewPx, width: Math.max(previewPx.width, minPx), height: Math.max(previewPx.height, minPx) }
              : previewPx
          onCommit(toPct(finalPx))
        }
      }
      setDrag(null)
      setPreviewPx(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, size, previewPx])

  const readOnlyBoxes = boxes.filter((b) => b.key !== activeKey)

  return (
    <div
      ref={containerRef}
      className={`relative inline-block border-2 border-white select-none ${
        activeKey && !activeBox ? 'cursor-crosshair' : ''
      }`}
      onMouseDown={activeBox ? undefined : startCreate}
      style={size ? { width: size.width, height: size.height } : undefined}
    >
      <canvas ref={canvasRef} className="block max-w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold tracking-widest text-white uppercase">
          Rendering…
        </div>
      )}

      {readOnlyBoxes.map((box) => {
        const px = toPx(box)
        return (
          <div
            key={box.key}
            className={`pointer-events-none absolute border-2 border-dashed ${box.colorClass} border-current`}
            style={{ left: px.x, top: px.y, width: px.width, height: px.height }}
          >
            <span className="absolute -top-5 left-0 border-2 border-black bg-current px-1.5 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap text-black uppercase">
              {box.label}
            </span>
          </div>
        )
      })}

      {activeBox &&
        (() => {
          const px = previewPx && drag ? previewPx : toPx(activeBox)
          return (
            <div
              className={`absolute border-2 border-solid ${activeBox.colorClass} border-current bg-current/10 cursor-move`}
              style={{ left: px.x, top: px.y, width: px.width, height: px.height }}
              onMouseDown={handleBoxMouseDown}
            >
              <span className="pointer-events-none absolute -top-5 left-0 border-2 border-black bg-current px-1.5 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap text-black uppercase">
                {activeBox.label}
              </span>
              <div
                className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-sm border-2 border-black bg-current"
                onMouseDown={handleResizeMouseDown}
              />
            </div>
          )
        })()}

      {!activeBox && activeKey && drag?.mode === 'creating' && previewPx && (
        <div
          className="pointer-events-none absolute border-2 border-solid border-primary bg-primary/10"
          style={{ left: previewPx.x, top: previewPx.y, width: previewPx.width, height: previewPx.height }}
        />
      )}
    </div>
  )
}
