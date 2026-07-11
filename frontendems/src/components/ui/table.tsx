import * as React from 'react'
import { cn } from '@/lib/utils'

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full border-collapse caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-0 border-0', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0 border-0', className)} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'hover:bg-secondary/50 data-[state=selected]:bg-secondary/80 border-0 transition-colors duration-200 rounded-xl',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'text-muted-foreground/80 h-12 px-4 text-left align-middle font-bold text-[10px] uppercase tracking-widest whitespace-nowrap border-0',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td className={cn('py-4 px-4 align-middle whitespace-nowrap border-0 text-foreground/90 font-medium', className)} {...props} />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
