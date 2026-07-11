import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:ring-4 focus-visible:ring-primary/10 shadow-sm active:scale-[0.96] hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground border-0 shadow-button hover:brightness-105',
        destructive:
          'bg-destructive text-white hover:bg-destructive/95 border-0 shadow-md shadow-destructive/10',
        outline:
          'border-0 bg-secondary/80 text-foreground hover:bg-secondary hover:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0',
        ghost: 'hover:bg-secondary/70 hover:text-foreground border-0',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
