import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-lg border border-transparent bg-secondary/60 px-3.5 py-2.5 text-sm transition-colors duration-150 outline-none text-foreground',
        'placeholder:text-muted-foreground/70 selection:bg-primary/20 selection:text-foreground',
        'focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/15',
        'aria-invalid:border-destructive/40 aria-invalid:bg-destructive/5 aria-invalid:text-destructive',
        // See input.tsx's matching comment — disabled reads as plain text,
        // not a washed-out control.
        'disabled:pointer-events-none disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-foreground disabled:opacity-100',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
