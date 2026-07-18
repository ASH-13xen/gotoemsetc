import { useState } from 'react'
import { toast } from 'sonner'
import { Flag, Plus, Trash2, Trophy } from 'lucide-react'
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

const COLOR_STYLE: Record<
  'red' | 'green',
  { badgePill: string; row: string; label: string; icon: typeof Trophy }
> = {
  green: {
    badgePill: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25',
    row: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    label: 'Green — good work',
    icon: Trophy,
  },
  red: {
    badgePill: 'bg-red-500/15 text-red-600 ring-1 ring-red-500/25',
    row: 'bg-red-500/10 text-red-700 border-red-500/20',
    label: 'Red — poor work',
    icon: Flag,
  },
}

// Compact, always-visible "scoreboard" — a trophy tally for good work and a
// flag tally for poor work, not a per-flag dot strip (doesn't scale once
// there are more than a couple of flags, and reads flat/uninteresting).
export function FlagStrip({ flags }: { flags: EmployeeFlag[] }) {
  if (flags.length === 0) return null
  const greenCount = flags.filter((f) => f.color === 'green').length
  const redCount = flags.filter((f) => f.color === 'red').length
  const sorted = [...flags].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const latest = sorted[0]

  return (
    <div
      className="flex items-center gap-1.5"
      title={latest ? `Latest: ${COLOR_STYLE[latest.color].label} · ${new Date(latest.date).toLocaleDateString()} — ${latest.note}` : undefined}
    >
      {greenCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums transition-transform hover:scale-105',
            COLOR_STYLE.green.badgePill
          )}
        >
          <Trophy className="size-3 fill-current" />
          {greenCount}
        </span>
      )}
      {redCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums transition-transform hover:scale-105',
            COLOR_STYLE.red.badgePill
          )}
        >
          <Flag className="size-3 fill-current" />
          {redCount}
        </span>
      )}
    </div>
  )
}

// Full manage panel — add a new flag (any date, mandatory note) and remove
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
  const greenCount = flags.filter((f) => f.color === 'green').length
  const redCount = flags.filter((f) => f.color === 'red').length
  const netScore = greenCount - redCount

  const canSubmit = note.trim().length > 0 && !addFlag.isPending

  const onAdd = () => {
    if (!canSubmit) return
    addFlag.mutate(
      { color, note: note.trim(), date },
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
          <Trophy className="size-3.5" />
          Flags
          {flags.length > 0 && <span className="text-xs text-muted-foreground">({flags.length})</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Performance flags</DialogTitle>
          <DialogDescription>
            Trophy for good work, flag for poor work. Any date, any number, a note is required — visible on this
            employee's profile.
          </DialogDescription>
        </DialogHeader>

        {/* Scoreboard */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-secondary/30 p-3 text-center">
          <div>
            <p className="flex items-center justify-center gap-1 text-2xl font-black text-emerald-600">
              <Trophy className="size-4 fill-current" />
              {greenCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Good work</p>
          </div>
          <div>
            <p className={cn('text-2xl font-black', netScore > 0 ? 'text-emerald-600' : netScore < 0 ? 'text-red-600' : 'text-muted-foreground')}>
              {netScore > 0 ? `+${netScore}` : netScore}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Net score</p>
          </div>
          <div>
            <p className="flex items-center justify-center gap-1 text-2xl font-black text-red-600">
              <Flag className="size-4 fill-current" />
              {redCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Poor work</p>
          </div>
        </div>

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
            <Label>Note (required)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened…" required />
          </div>
          <Button size="sm" className="justify-self-start" onClick={onAdd} disabled={!canSubmit}>
            <Plus className="size-3.5" />
            Add flag
          </Button>
        </div>

        <div className="grid gap-2 max-h-64 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">No flags yet.</p>
          ) : (
            sorted.map((flag) => {
              const Icon = COLOR_STYLE[flag.color].icon
              return (
                <div
                  key={flag._id}
                  className={cn('flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm', COLOR_STYLE[flag.color].row)}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className="mt-0.5 size-3.5 shrink-0 fill-current" />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {flag.color === 'red' ? 'Poor work' : 'Good work'} · {new Date(flag.date).toLocaleDateString()}
                      </p>
                      <p className="truncate text-xs opacity-80">{flag.note}</p>
                    </div>
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
              )
            })
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
