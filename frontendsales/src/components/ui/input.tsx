import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-xl border-0 bg-secondary/50 px-4 py-2 text-sm transition-all duration-300 outline-none font-medium text-foreground',
        'placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10',
        'aria-invalid:bg-destructive/10 aria-invalid:text-destructive',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
