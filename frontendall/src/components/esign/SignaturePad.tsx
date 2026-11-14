import { useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, Type } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const W = 560
const H = 180
const FONT = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", "Snell Roundhand", cursive'

// A signature, drawn (mouse, finger or pen) or typed in a handwriting font —
// handed back as a transparent PNG (data URL), or null while empty.
export function SignaturePad({ onChange, typedName }: { onChange: (png: string | null) => void; typedName: string }) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const drawn = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)

  const ctx = () => {
    const c = canvasRef.current
    const g = c?.getContext('2d')
    if (!c || !g) return null
    return { c, g }
  }
  const clear = () => {
    const x = ctx()
    if (!x) return
    x.g.clearRect(0, 0, W, H)
    drawn.current = false
    onChange(null)
  }

  // Typed: the name in a handwriting font.
  useEffect(() => {
    if (mode !== 'type') return
    const x = ctx()
    if (!x) return
    x.g.clearRect(0, 0, W, H)
    const text = typed.trim()
    if (!text) {
      onChange(null)
      return
    }
    let size = 64
    x.g.fillStyle = '#0f172a'
    x.g.textBaseline = 'middle'
    do {
      x.g.font = `${size}px ${FONT}`
      size -= 4
    } while (x.g.measureText(text).width > W - 40 && size > 20)
    x.g.fillText(text, 20, H / 2)
    onChange(x.c.toDataURL('image/png'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode])

  useEffect(() => {
    if (mode === 'type' && !typed && typedName) setTyped(typedName)
    if (mode === 'draw') clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = point(e)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || mode !== 'draw') return
    const x = ctx()
    if (!x || !last.current) return
    const p = point(e)
    x.g.strokeStyle = '#0f172a'
    x.g.lineWidth = 3
    x.g.lineCap = 'round'
    x.g.lineJoin = 'round'
    x.g.beginPath()
    x.g.moveTo(last.current.x, last.current.y)
    x.g.lineTo(p.x, p.y)
    x.g.stroke()
    last.current = p
    drawn.current = true
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    const x = ctx()
    if (x && drawn.current) onChange(x.c.toDataURL('image/png'))
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 text-sm">
        {(
          [
            ['draw', 'Draw', PenLine],
            ['type', 'Type', Type],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={cn('inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition', mode === k ? 'bg-background shadow-sm' : 'text-muted-foreground')}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {mode === 'type' && <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" maxLength={60} />}
      <div className="relative rounded-xl border-2 border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className={cn('block h-auto w-full touch-none rounded-xl', mode === 'draw' && 'cursor-crosshair')}
          aria-label="Signature"
        />
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-slate-300" />
        {mode === 'draw' && (
          <button type="button" onClick={clear} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-slate-900">
            <Eraser className="size-3.5" />
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{mode === 'draw' ? 'Sign in the box with your mouse, finger or pen.' : 'Your name, in a handwriting style.'}</p>
    </div>
  )
}
