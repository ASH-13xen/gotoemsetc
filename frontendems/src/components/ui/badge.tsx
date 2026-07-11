import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border-0 px-3 py-1 text-[10px] font-bold w-fit whitespace-nowrap gap-1.5 shadow-none transition-all uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'bg-transparent text-muted-foreground ring-1 ring-border/50',
        success: 'bg-emerald-500/10 text-emerald-700',
        warning: 'bg-amber-500/10 text-amber-700',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
