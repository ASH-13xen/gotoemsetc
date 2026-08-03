import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkTeams } from '@/hooks/useWorkTeams'

export function TeamSingleSelect({
  value,
  onChange,
  placeholder = 'SELECT TEAM',
  includeIds,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  // When set, restricts the list to only these team ids (e.g. a team
  // leader's own led teams) instead of every team.
  includeIds?: string[]
}) {
  const { data } = useWorkTeams()
  const options = (data?.teams ?? []).filter((team) => !includeIds || includeIds.includes(team._id))

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((team) => (
          <SelectItem key={team._id} value={team._id}>
            {team.name.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
