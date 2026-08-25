import { useState } from 'react'
import { toast } from 'sonner'
import { Key, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const UNASSIGNED = '__unassigned__'

// Reassigning a key is admin/ceo/operations_manager only — matches the
// backend's requireOperationsAccess() exactly (deliberately excludes hr).
function useCanManageKeys() {
  const { user } = useAuth()
  return user?.role === 'admin' || user?.role === 'ceo' || user?.role === 'operations_manager'
}

function KeyRow({ entry }: { entry: KeyHolderEntry }) {
  const canManage = useCanManageKeys()
  const { data: employees } = useOpenEmployeeDirectory()
  const assignKey = useAssignKey()
  const color = KEY_COLOR[entry.key]
  const holderName = entry.holder ? `${entry.holder.firstName} ${entry.holder.lastName ?? ''}`.trim() : null

  const onAssign = (value: string) => {
    assignKey.mutate(
      { key: entry.key, employeeId: value === UNASSIGNED ? null : value },
      {
        onSuccess: () => toast.success(`${KEY_LABEL[entry.key]} updated`),
        onError: () => toast.error('Could not update this key'),
      }
    )
  }

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between', color.border)}>
      <div className="flex items-center gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', color.badge)}>
          <Key className={cn('size-4', color.icon)} />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{KEY_LABEL[entry.key]}</p>
          {holderName ? (
            <p className="text-xs text-muted-foreground">
              Held by <span className="font-medium text-foreground">{holderName}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Unassigned</p>
          )}
        </div>
      </div>

      {canManage ? (
        <Select value={entry.holder?._id ?? UNASSIGNED} onValueChange={onAssign} disabled={assignKey.isPending}>
          <SelectTrigger className="w-full sm:w-56">
            {assignKey.isPending ? <Loader2 className="size-4 animate-spin" /> : <SelectValue />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>— Unassigned —</SelectItem>
            {(employees ?? []).map((emp) => (
              <SelectItem key={emp._id} value={emp._id}>
                {emp.firstName} {emp.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="outline" className="w-fit">
          {holderName ?? 'Unassigned'}
        </Badge>
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
        <Button variant="outline" className="rounded-xl">
          <Key className="size-4" />
          Office Keys
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Office Keys</DialogTitle>
          <DialogDescription>Who currently holds each of the office's 5 keys.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl bg-secondary/40" />)
          ) : (
            OFFICE_KEYS.map((key: OfficeKey) => {
              const entry = byKey.get(key) ?? { key, holder: null, updatedBy: null, updatedAt: null }
              return <KeyRow key={key} entry={entry} />
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
