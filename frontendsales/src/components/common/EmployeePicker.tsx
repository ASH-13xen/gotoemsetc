import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmployeeDirectory } from '@/hooks/useEmployees'

interface EmployeePickerProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

// Checkbox-list employee picker — used for meeting attendees and client
// employee assignment.
export function EmployeePicker({ selectedIds, onChange }: EmployeePickerProps) {
  const { data, isLoading } = useEmployeeDirectory()
  const employees = data?.items ?? []

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  return (
    <div className="max-h-48 overflow-y-auto border-2 border-foreground">
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
                'flex w-full items-center gap-2 border-b-2 border-foreground/20 p-3 text-left last:border-b-0 hover:bg-accent',
                selected && 'bg-accent'
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center border-2',
                  selected ? 'border-primary bg-primary' : 'border-foreground'
                )}
              >
                {selected && <Check className="size-3 text-primary-foreground" />}
              </span>
              <span className="text-sm font-bold uppercase tracking-wide">
                {emp.firstName} {emp.lastName}
              </span>
              <span className="text-xs text-muted-foreground">· {emp.designation}</span>
            </button>
          )
        })
      )}
    </div>
  )
}
