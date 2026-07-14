import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmployeePicker } from '@/components/common/EmployeePicker'
import { useAssignEmployees } from '@/hooks/useClients'
import type { AssignedEmployee } from '@/api/clients.api'
import { useEmployeeDirectory } from '@/hooks/useEmployees'

const NO_MAIN = '__none__'

export function AssignEmployeesDialog({
  clientId,
  currentAssigned,
  currentMain,
}: {
  clientId: string
  currentAssigned: AssignedEmployee[]
  currentMain?: AssignedEmployee
}) {
  const [open, setOpen] = useState(false)
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [mainId, setMainId] = useState<string>(NO_MAIN)
  const assign = useAssignEmployees(clientId)
  const { data } = useEmployeeDirectory()
  const employees = data?.items ?? []

  useEffect(() => {
    if (open) {
      setAssignedIds(currentAssigned.map((e) => e._id))
      setMainId(currentMain?._id ?? NO_MAIN)
    }
  }, [open, currentAssigned, currentMain])

  const onAssignedChange = (ids: string[]) => {
    setAssignedIds(ids)
    // The point of accountability has to still be one of the assigned
    // people — drop it if it just got unassigned.
    if (mainId !== NO_MAIN && !ids.includes(mainId)) setMainId(NO_MAIN)
  }

  const onSubmit = () => {
    assign.mutate(
      { assignedEmployees: assignedIds, mainEmployee: mainId === NO_MAIN ? null : mainId },
      {
        onSuccess: () => {
          toast.success('Assignment updated')
          setOpen(false)
        },
        onError: () => toast.error('Could not update assignment'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-4" />
          {currentAssigned.length > 0 ? 'Edit Assignment' : 'Assign Employees'}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-2 border-white bg-black text-white">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest">Assign employees</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Pick who's handling this client, then mark one of them as the main point of accountability.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Assigned employees</Label>
            <EmployeePicker selectedIds={assignedIds} onChange={onAssignedChange} />
          </div>

          <div className="grid gap-1.5">
            <Label>Main employee (answerable)</Label>
            <Select value={mainId} onValueChange={setMainId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No main employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MAIN}>None</SelectItem>
                {employees
                  .filter((e) => assignedIds.includes(e._id))
                  .map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {assignedIds.length === 0 && (
              <p className="text-xs text-muted-foreground">Assign at least one employee to pick a main contact.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onSubmit} disabled={assign.isPending}>
            {assign.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
