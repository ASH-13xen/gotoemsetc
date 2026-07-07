import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check } from 'lucide-react'

interface SignaturePadProps {
  onConfirm: (pngDataUrl: string) => void
  onCancel?: () => void
  confirmLabel?: string
}

// Canvas background is left fully transparent (never filled) so the
// exported PNG can be stamped straight onto a PDF without a white box
// covering the printed signature line underneath it.
export function SignaturePad({ onConfirm, onCancel, confirmLabel = 'OK, USE THIS SIGNATURE' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getContext = () => canvasRef.current?.getContext('2d') ?? null

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastPointRef.current = pointFromEvent(e)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = getContext()
    const last = lastPointRef.current
    if (!ctx || !last) return
    const point = pointFromEvent(e)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
    if (!hasDrawn) setHasDrawn(true)
  }

  const stopDrawing = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  const retake = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }, [])

  const confirm = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    onConfirm(canvas.toDataURL('image/png'))
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          className="h-[220px] w-full touch-none bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      <p className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
        Sign above using your mouse, stylus, or finger.
      </p>
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={retake}>
          <RotateCcw className="size-4" />
          RETAKE
        </Button>
        <Button
          type="button"
          className="flex-1 bg-primary text-white hover:opacity-90"
          disabled={!hasDrawn}
          onClick={confirm}
        >
          <Check className="size-4" />
          {confirmLabel}
        </Button>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs font-bold tracking-widest text-neutral-500 uppercase hover:text-white"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
