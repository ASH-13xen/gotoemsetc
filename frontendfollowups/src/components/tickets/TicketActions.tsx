import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Check, Loader2, Undo2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/api/tickets.api'
import { inkOn, tint } from '@/lib/ticketFormat'

// One dialog for every "do it, with a note" action — move forward, send
// back, reject, review.
export function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  required,
  placeholder,
  confirmLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: ReactNode
  required?: boolean
  placeholder?: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: (note: string) => Promise<unknown>
  children?: ReactNode
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setNote('')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder || (required ? 'Required' : 'Optional note — kept in the record')} rows={3} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || (required && !note.trim())}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm(note.trim())
                onOpenChange(false)
                setNote('')
              } catch (err) {
                toast.error(errorMessage(err, 'That did not work'))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The move buttons for whoever the ticket is waiting on. The main button
// wears the colour the ticket will turn.
export function MoveButtons({
  can,
  nextStepLabel,
  nextColor,
  actingAs,
  onAdvance,
  onSendBack,
  onReject,
  sendBackRequired = true,
}: {
  can: { act: boolean; sendBack: boolean }
  nextStepLabel: string | null | undefined
  nextColor: string | null | undefined
  actingAs?: string | null
  onAdvance: (note: string) => Promise<unknown>
  onSendBack: (note: string) => Promise<unknown>
  onReject: (reason: string) => Promise<unknown>
  sendBackRequired?: boolean
}) {
  const [dlg, setDlg] = useState<null | 'advance' | 'back' | 'reject'>(null)
  if (!can.act) return null
  return (
    <div className="grid gap-3 rounded-2xl p-4 ring-1 ring-border" style={{ background: tint(nextColor, 0.08) }}>
      <div>
        <p className="text-sm font-bold">This step is yours</p>
        <p className="text-xs text-muted-foreground">
          Next: <span className="font-semibold text-foreground">{nextStepLabel}</span>
          {actingAs ? ` — you're acting as ${actingAs}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDlg('advance')} className="bg-none shadow-none" style={{ background: nextColor || undefined, color: inkOn(nextColor) }}>
          <Check className="size-4" />
          Mark “{nextStepLabel}”
        </Button>
        {can.sendBack && (
          <Button variant="outline" onClick={() => setDlg('back')} className="text-pink-700">
            <Undo2 className="size-4" />
            Send back
          </Button>
        )}
        <Button variant="outline" onClick={() => setDlg('reject')} className="text-red-600">
          <XCircle className="size-4" />
          Reject
        </Button>
      </div>
      <NoteDialog
        open={dlg === 'advance'}
        onOpenChange={(v) => setDlg(v ? 'advance' : null)}
        title={`Mark “${nextStepLabel}”`}
        description="The ticket moves on and takes this step's colour. Your note is kept in the record."
        confirmLabel="Move it on"
        onConfirm={onAdvance}
      />
      <NoteDialog
        open={dlg === 'back'}
        onOpenChange={(v) => setDlg(v ? 'back' : null)}
        title="Send it back a step"
        description="It turns pink and goes back to whoever did the last step. The revert, and why, stays in the record."
        required={sendBackRequired}
        placeholder="What needs redoing?"
        confirmLabel="Send back"
        onConfirm={onSendBack}
      />
      <NoteDialog
        open={dlg === 'reject'}
        onOpenChange={(v) => setDlg(v ? 'reject' : null)}
        title="Reject this ticket?"
        description="It turns red, stops for everyone and goes to the CEO's Submitted section. This can't be undone."
        required
        placeholder="Why is it rejected?"
        confirmLabel="Reject ticket"
        destructive
        onConfirm={onReject}
      />
    </div>
  )
}
