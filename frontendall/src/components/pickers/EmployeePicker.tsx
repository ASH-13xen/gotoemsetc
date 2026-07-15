import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeDirectory } from '@/hooks/useEmployees'

interface EmployeePickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

// Checkbox-list employee picker — used for Inventory booking attribution
// context and Event responsibility assignment.
export function EmployeePicker({ selectedIds, onChange }: EmployeePickerProps) {
  const { data, isLoading } = useEmployeeDirectory()
  const employees = data ?? []

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
      {isLoading ? (
        <p className="p-3 text-sm text-muted-foreground">Loading employees…</p>
      ) : employees.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">No employees found.</p>
      ) : (
        employees.map((emp) => {
          const selected = selectedIds.includes(emp._id)
          return (
            <button
              key={emp._id}
              type="button"
              onClick={() => toggle(emp._id)}
              className={cn(
                'flex w-full items-center gap-2 border-b border-border/60 p-2.5 text-left text-sm last:border-b-0 hover:bg-secondary/50',
                selected && 'bg-secondary/60'
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded border',
                  selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                )}
              >
                {selected && <Check className="size-3 text-primary-foreground" />}
              </span>
              <span className="font-medium">
                {emp.firstName} {emp.lastName}
              </span>
              {emp.designation && <span className="text-xs text-muted-foreground">· {emp.designation}</span>}
            </button>
          )
        })
      )}
    </div>
  )
}
