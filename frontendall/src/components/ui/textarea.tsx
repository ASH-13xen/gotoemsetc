import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-none border-2 border-foreground bg-transparent px-4 py-3 text-sm shadow-none outline-none font-bold tracking-wider',
        'placeholder:text-muted-foreground/60',
        'focus-visible:border-primary',
        'aria-invalid:border-destructive',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
