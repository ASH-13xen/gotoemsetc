import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-lg border border-transparent bg-secondary/60 px-3.5 py-2 text-sm transition-colors duration-150 outline-none text-foreground',
        'placeholder:text-muted-foreground/70 selection:bg-primary/20 selection:text-foreground',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/15',
        'aria-invalid:border-destructive/40 aria-invalid:bg-destructive/5 aria-invalid:text-destructive',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
