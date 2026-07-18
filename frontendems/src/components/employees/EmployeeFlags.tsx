import { useState } from 'react'
import { toast } from 'sonner'
import { Flag, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAddFlag, useRemoveFlag } from '@/hooks/useEmployees'
import type { EmployeeFlag } from '@/api/employees.api'

const COLOR_STYLE: Record<'red' | 'green', { dot: string; badge: string; label: string }> = {
  red: { dot: 'bg-red-500', badge: 'bg-red-500/10 text-red-700 border-red-500/20', label: 'Red — poor work' },
  green: { dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20', label: 'Green — good work' },
}

// Compact, always-visible strip of colored dots (newest first) — a quick
// visual read on an employee's track record without opening anything.
export function FlagStrip({ flags }: { flags: EmployeeFlag[] }) {
  if (flags.length === 0) return null
  const sorted = [...flags].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return (
    <div className="flex items-center gap-1">
      {sorted.map((flag) => (
        <span
          key={flag._id}
          title={`${COLOR_STYLE[flag.color].label} · ${new Date(flag.date).toLocaleDateString()}${flag.note ? ` — ${flag.note}` : ''}`}
          className={cn('size-2.5 rounded-full ring-2 ring-background/80', COLOR_STYLE[flag.color].dot)}
        />
      ))}
    </div>
  )
}

// Full manage panel — add a new flag (any date, optional note) and remove
// existing ones. Only rendered for admin/HR by the caller.
export function EmployeeFlagsManager({
  employeeId,
  flags,
}: {
  employeeId: string
  flags: EmployeeFlag[]
}) {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState<'red' | 'green'>('red')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  const addFlag = useAddFlag(employeeId)
  const removeFlag = useRemoveFlag(employeeId)

  const sorted = [...flags].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const onAdd = () => {
    addFlag.mutate(
      { color, note: note.trim() || undefined, date },
      {
        onSuccess: () => {
          toast.success('Flag added')
          setNote('')
        },
        onError: () => toast.error('Could not add flag'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Flag className="size-3.5" />
          Flags
          {flags.length > 0 && <span className="text-xs text-muted-foreground">({flags.length})</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Performance flags</DialogTitle>
          <DialogDescription>
            Red for poor work, green for good work. Any date, any number — visible on this employee's profile.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Color</Label>
              <Select value={color} onValueChange={(v) => setColor(v as 'red' | 'green')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">Red — poor work</SelectItem>
                  <SelectItem value="green">Green — good work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened…" />
          </div>
          <Button size="sm" className="justify-self-start" onClick={onAdd} disabled={addFlag.isPending}>
            <Plus className="size-3.5" />
            Add flag
          </Button>
        </div>

        <div className="grid gap-2 max-h-64 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No flags yet.</p>
          ) : (
            sorted.map((flag) => (
              <div
                key={flag._id}
                className={cn('flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm', COLOR_STYLE[flag.color].badge)}
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {flag.color === 'red' ? 'Red' : 'Green'} · {new Date(flag.date).toLocaleDateString()}
                  </p>
                  {flag.note && <p className="truncate text-xs opacity-80">{flag.note}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    removeFlag.mutate(flag._id, {
                      onSuccess: () => toast.success('Flag removed'),
                      onError: () => toast.error('Could not remove flag'),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
