import { Checkbox } from '@/components/ui/checkbox'
import { useEmployees } from '@/hooks/useEmployees'
import type { EmployeeSummary } from '@/api/employees.api'

function EmployeeRow({
  employee,
  checked,
  onToggle,
}: {
  employee: EmployeeSummary
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-secondary/50">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {`${employee.firstName} ${employee.lastName ?? ''}`.trim()}
    </label>
  )
}

export function EmployeeMultiSelect({
  value,
  onChange,
  excludeIds = [],
  includeIds,
  priorityIds,
  priorityLabel = 'Team',
  restLabel = 'Other Employees',
}: {
  value: string[]
  onChange: (value: string[]) => void
  excludeIds?: string[]
  // When set, restricts the list to only these ids (e.g. a team leader's
  // own team roster) instead of every active employee.
  includeIds?: string[]
  // When set, splits the list into two labeled groups (e.g. the parent
  // task's team roster vs. everyone else) instead of one flat list — so
  // any employee can still be picked, but the team is easy to spot first.
  priorityIds?: string[]
  priorityLabel?: string
  restLabel?: string
}) {
  const { data } = useEmployees({ status: 'active', limit: 100 })
  const options = (data?.items ?? [])
    .filter((employee) => !excludeIds.includes(employee._id))
    .filter((employee) => !includeIds || includeIds.includes(employee._id))
    .sort((a, b) =>
      `${a.firstName} ${a.lastName ?? ''}`.trim().localeCompare(`${b.firstName} ${b.lastName ?? ''}`.trim())
    )

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  if (!priorityIds) {
    return (
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-secondary/30 p-2">
        {options.length === 0 && <p className="p-2 text-xs text-muted-foreground">No employees found.</p>}
        {options.map((employee) => (
          <EmployeeRow key={employee._id} employee={employee} checked={value.includes(employee._id)} onToggle={() => toggle(employee._id)} />
        ))}
      </div>
    )
  }

  const priority = options.filter((employee) => priorityIds.includes(employee._id))
  const rest = options.filter((employee) => !priorityIds.includes(employee._id))

  return (
    <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl bg-secondary/30 p-2">
      {priority.length > 0 && (
        <div>
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{priorityLabel}</p>
          <div className="space-y-1">
            {priority.map((employee) => (
              <EmployeeRow key={employee._id} employee={employee} checked={value.includes(employee._id)} onToggle={() => toggle(employee._id)} />
            ))}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{restLabel}</p>
          <div className="space-y-1">
            {rest.map((employee) => (
              <EmployeeRow key={employee._id} employee={employee} checked={value.includes(employee._id)} onToggle={() => toggle(employee._id)} />
            ))}
          </div>
        </div>
      )}
      {options.length === 0 && <p className="p-2 text-xs text-muted-foreground">No employees found.</p>}
    </div>
  )
}
