import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-none border-2 px-2.5 py-1 text-xs font-bold uppercase tracking-widest w-fit whitespace-nowrap gap-1',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground',
        secondary: 'border-secondary bg-secondary text-secondary-foreground',
        outline: 'border-foreground text-foreground bg-transparent',
        success: 'border-emerald-500 bg-emerald-950/40 text-emerald-400',
        warning: 'border-amber-500 bg-amber-950/40 text-amber-400',
        destructive: 'border-destructive bg-destructive/10 text-destructive',
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
