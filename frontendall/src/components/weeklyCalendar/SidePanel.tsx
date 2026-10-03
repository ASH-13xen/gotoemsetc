import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// The right-hand glass panel used for creating and viewing events. Slides
// in with GSAP; sections stagger up. clearProps matters: a leftover
// transform makes each section its own stacking layer, which lets a later
// section paint over an earlier one's dropdown.
export function SidePanel({
  panelKey,
  accent,
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  panelKey: string
  accent: { from: string; to: string; soft: string }
  eyebrow: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { x: 48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' })
      gsap.fromTo('.wc-sec', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, delay: 0.1, ease: 'power2.out', clearProps: 'transform,opacity' })
    }, ref)
    return () => ctx.revert()
  }, [panelKey])

  return (
    <aside
      ref={ref}
      data-wc-panel
      className="fixed top-3 right-3 bottom-3 z-50 flex w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card/95 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl"
    >
      <div className="relative px-5 pt-5 pb-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(150deg, ${accent.soft}, transparent 72%)` }} />
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">{eyebrow}</div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="relative mt-2.5">{title}</div>
        {subtitle && <div className="relative mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-4">{children}</div>
      {footer && <div className="border-t border-border bg-card/90 px-5 py-3">{footer}</div>}
    </aside>
  )
}

export function Sec({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn('wc-sec grid gap-2.5 border-t border-border/70 px-5 py-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Chip({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase', className)} style={style}>
      {children}
    </span>
  )
}
