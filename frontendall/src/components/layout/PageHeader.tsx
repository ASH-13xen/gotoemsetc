import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

// frontendall's counterpart to frontendems's PageHeader — same flat design
// system, but titles run one step bolder/larger (font-black vs
// font-semibold, one size up) since this is the shell every remote sits
// inside and should read as the more confident, top-level surface.
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex flex-col gap-1.5">
        {eyebrow && <span className="text-xs font-medium text-muted-foreground">{eyebrow}</span>}
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
