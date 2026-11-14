import { useState, type ReactNode } from 'react'
import { ChevronDown, Eye, EyeOff, Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// The employee profile's building blocks: collapsible sections, the ⓘ
// explanations, tick rows and the password field.

// A section that folds away. `flat`: its content is one card that already
// has its own title — its border and title are dropped so it doesn't repeat.
export function Section({
  title,
  open,
  onToggle,
  badge,
  flat = false,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  badge?: ReactNode
  flat?: boolean
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/30">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {badge}
        <ChevronDown className={cn('ml-auto size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'border-t border-border p-5',
            flat &&
              '[&>[data-slot=card]]:gap-3 [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-transparent [&>[data-slot=card]]:py-0 [&>[data-slot=card]>[data-slot=card-content]]:px-0 [&>[data-slot=card]>[data-slot=card-content]]:pb-0 [&>[data-slot=card]>[data-slot=card-header]]:hidden'
          )}
        >
          {children}
        </div>
      )}
    </section>
  )
}

export function MissingBadge({ count }: { count: number }) {
  if (!count) return null
  return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{count} missing</span>
}

// ⓘ — the longer explanation, on click.
export function InfoTip({ children, label = 'More about this' }: { children: ReactNode; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  info,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  info?: ReactNode
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 pr-1 transition-colors hover:bg-secondary/50">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 p-3 select-none">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 shrink-0 cursor-pointer rounded border-border accent-primary"
        />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
      {info && <InfoTip>{info}</InfoTip>}
    </div>
  )
}

// A password that reads back in its real case, hidden until asked.
export function SecretInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} autoComplete="new-password" className={cn('pr-10 normal-case', className)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide' : 'Show'}
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

// Which sections are open — remembered per browser.
const OPEN_KEY = 'ems.profile.sections'
export function useOpenSections(defaults: string[]) {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(OPEN_KEY)
      if (raw) return new Set(JSON.parse(raw) as string[])
    } catch {
      /* private window etc. */
    }
    return new Set(defaults)
  })
  const save = (next: Set<string>) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }
  return {
    isOpen: (k: string) => open.has(k),
    toggle: (k: string) => {
      const next = new Set(open)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      save(next)
    },
    openAll: (keys: string[]) => save(new Set([...open, ...keys])),
  }
}
