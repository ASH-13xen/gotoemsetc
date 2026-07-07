import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap gap-1 shadow-sm transition-all',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary/10 text-primary',
        secondary: 'border-secondary bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground bg-transparent',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
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
