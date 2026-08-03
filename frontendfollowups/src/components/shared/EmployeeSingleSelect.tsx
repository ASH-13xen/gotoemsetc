import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEmployees } from '@/hooks/useEmployees'

export function EmployeeSingleSelect({
  value,
  onChange,
  placeholder = 'SELECT',
  excludeId,
  includeIds,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  excludeId?: string
  // When set, restricts the list to only these ids (e.g. a team leader's
  // own team roster) instead of every active employee.
  includeIds?: string[]
}) {
  const { data } = useEmployees({ status: 'active', limit: 100 })
  const options = (data?.items ?? [])
    .filter((employee) => employee._id !== excludeId)
    .filter((employee) => !includeIds || includeIds.includes(employee._id))

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((employee) => (
          <SelectItem key={employee._id} value={employee._id}>
            {`${employee.firstName} ${employee.lastName ?? ''}`.trim().toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
