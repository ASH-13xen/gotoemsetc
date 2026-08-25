import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function QuickActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

interface QuickActionItemProps {
  icon: ReactNode
  label: string
  description?: string
  onClick?: () => void
  className?: string
}

// Replaces the old colored-tile navigation pattern — one icon+label control
// per action, differentiated by icon/label instead of a rainbow fill color.
// Renders as a <button> so it can also be dropped straight into a
// `<DialogTrigger asChild>`.
export function QuickActionItem({ icon, label, description, onClick, className }: QuickActionItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary/40',
        className
      )}
    >
      <span className="text-muted-foreground transition-colors group-hover:text-primary">{icon}</span>
      <span className="flex flex-col leading-tight">
        {label}
        {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
      </span>
    </button>
  )
}
