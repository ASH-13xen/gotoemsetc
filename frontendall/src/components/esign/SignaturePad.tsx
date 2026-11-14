import { useRef } from 'react'
import { Eraser } from 'lucide-react'

const W = 560
const H = 180

// A signature drawn with a mouse, finger or pen — handed back as a
// transparent PNG (data URL), or null while empty.
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const drawn = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  const ctx = () => canvasRef.current?.getContext('2d') ?? null
  const clear = () => {
    ctx()?.clearRect(0, 0, W, H)
    drawn.current = false
    onChange(null)
  }
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = ctx()
    if (!drawing.current || !g || !last.current) return
    const p = point(e)
    g.strokeStyle = '#0f172a'
    g.lineWidth = 3
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(last.current.x, last.current.y)
    g.lineTo(p.x, p.y)
    g.stroke()
    last.current = p
    drawn.current = true
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    if (drawn.current && canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div className="grid gap-2">
      <div className="relative rounded-xl border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="block h-auto w-full cursor-crosshair touch-none rounded-xl"
          aria-label="Signature"
        />
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-slate-300" />
        <button type="button" onClick={clear} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-slate-900">
          <Eraser className="size-3.5" />
          Clear
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Sign in the box with your mouse, finger or pen.</p>
    </div>
  )
}
