import { can } from '@/lib/access'
import { useState } from 'react'
import { toast } from 'sonner'
import { Key, Loader2, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useOpenEmployeeDirectory } from '@/hooks/useEmployees'
import { useKeys, useAssignKey } from '@/hooks/useKeys'
import { OFFICE_KEYS, KEY_LABEL, KEY_COLOR, type KeyHolderEntry, type OfficeKey } from '@/api/keys.api'

// Reassigning a key is admin/ceo/operations_manager only — matches the
// backend's requireOperationsAccess() exactly (deliberately excludes hr).
function useCanManageKeys() {
  const { user } = useAuth()
  return can(user, 'office_keys_edit')
}

function holderNames(entry: KeyHolderEntry): string {
  if (entry.holders.length === 0) return 'Unassigned'
  return entry.holders.map((h) => `${h.firstName} ${h.lastName ?? ''}`.trim()).join(', ')
}

// Several physical copies of the same key can be out with different people
// at once (e.g. 3 copies of the main gate key among 3 employees) — this is a
// checklist, not a single-pick dropdown. Each toggle saves immediately.
//
// The trigger is a fixed-size "Manage" button, deliberately never showing
// the holder list itself — it used to render every holder's name as the
// button's own label inside a fixed-width box, which either truncated an
// unknown number of names or forced the whole row to stretch/misalign once
// a key had several holders. The actual holder list now renders as its own
// wrapping row in KeyRow below, completely decoupled from this control.
function HolderPicker({ entry }: { entry: KeyHolderEntry }) {
  const [open, setOpen] = useState(false)
  const { data: employees } = useOpenEmployeeDirectory()
  const assignKey = useAssignKey()
  const holderIds = entry.holders.map((h) => h._id)

  const toggle = (employeeId: string) => {
    const nextIds = holderIds.includes(employeeId)
      ? holderIds.filter((id) => id !== employeeId)
      : [...holderIds, employeeId]
    assignKey.mutate(
      { key: entry.key, employeeIds: nextIds },
      {
        onSuccess: () => toast.success(`${KEY_LABEL[entry.key].toUpperCase()} UPDATED`),
        onError: () => toast.error('COULD NOT UPDATE THIS KEY'),
      }
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={assignKey.isPending}
          aria-label={`Manage holders for ${KEY_LABEL[entry.key]} — currently: ${holderNames(entry)}`}
        >
          {assignKey.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5 opacity-60" />}
          {assignKey.isPending ? 'Saving…' : 'Manage'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 uppercase" align="end">
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {(employees ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">No employees found.</p>}
          {(employees ?? []).map((emp) => (
            <label
              key={emp._id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium select-none hover:bg-secondary/50"
            >
              <input
                type="checkbox"
                checked={holderIds.includes(emp._id)}
                onChange={() => toggle(emp._id)}
                className="size-4 cursor-pointer rounded border-border text-primary accent-primary focus:ring-primary"
              />
              {emp.firstName} {emp.lastName}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function KeyRow({ entry }: { entry: KeyHolderEntry }) {
  const canManage = useCanManageKeys()
  const color = KEY_COLOR[entry.key]

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4', color.border)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', color.badge)}>
            <Key className={cn('size-4', color.icon)} />
          </span>
          <p className="text-sm font-semibold text-foreground">{KEY_LABEL[entry.key]}</p>
        </div>
        {canManage && <HolderPicker entry={entry} />}
      </div>

      {/* Its own full-width row, independent of the icon/name/Manage-button
          row above — any number of holders just wraps onto more lines here,
          never squeezing or overflowing anything else in the card. */}
      {entry.holders.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pl-12">
          {entry.holders.map((h) => (
            <Badge key={h._id} variant="outline" className="w-fit">
              {h.firstName} {h.lastName ?? ''}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="pl-12 text-xs text-muted-foreground">Unassigned</p>
      )}
    </div>
  )
}

// Read access is everyone; reassigning is admin/ceo/operations_manager —
// see useCanManageKeys above and requireOperationsAccess() server-side.
export function KeysDialog() {
  const [open, setOpen] = useState(false)
  const { data, isLoading } = useKeys()
  const keys = data?.keys ?? []
  const byKey = new Map(keys.map((k) => [k.key, k]))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl uppercase">
          <Key className="size-4" />
          Office Keys
        </Button>
      </DialogTrigger>
      {/* Everything in Office Keys displays in uppercase — names, labels and
          descriptions alike (the stored values are unchanged). */}
      <DialogContent className="max-h-[85vh] overflow-y-auto uppercase sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Office Keys</DialogTitle>
          <DialogDescription>Who currently holds each of the office's 5 keys.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl bg-secondary/40" />)
          ) : (
            OFFICE_KEYS.map((key: OfficeKey) => {
              const entry = byKey.get(key) ?? { key, holders: [], updatedBy: null, updatedAt: null }
              return <KeyRow key={key} entry={entry} />
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
