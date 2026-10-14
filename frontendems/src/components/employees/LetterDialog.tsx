import { useState, type ReactNode } from 'react'
import { Loader2, Paperclip } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Some changes to an employee only go through with a letter attached —
// completing probation, changing a salary. The letter is kept in the
// employee's documents. `children` adds anything else the change needs
// (the month a new salary starts from).
export function LetterDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending,
  canConfirm = true,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  isPending: boolean
  canConfirm?: boolean
  onConfirm: (letter: File) => void
  children?: ReactNode
}) {
  const [letter, setLetter] = useState<File | undefined>()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        if (!next) setLetter(undefined)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {children}
          <div className="grid gap-1.5">
            <Label htmlFor="letterFile">Letter</Label>
            <Input
              id="letterFile"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              disabled={isPending}
              onChange={(e) => setLetter(e.target.files?.[0])}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="size-3" /> Required — PDF or image, up to 10 MB. It is saved in this employee's documents.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => letter && onConfirm(letter)} disabled={isPending || !letter || !canConfirm}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
