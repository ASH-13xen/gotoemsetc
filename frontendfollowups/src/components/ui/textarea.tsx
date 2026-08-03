import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-xl border-0 bg-secondary/50 px-4 py-3 text-sm transition-all duration-300 outline-none font-medium text-foreground',
        'placeholder:text-muted-foreground/60 selection:bg-primary/20 selection:text-foreground',
        'focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10',
        'aria-invalid:bg-destructive/10 aria-invalid:text-destructive',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
