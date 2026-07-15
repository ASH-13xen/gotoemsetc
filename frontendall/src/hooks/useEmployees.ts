import { useQuery } from '@tanstack/react-query'
import { listEmployeeDirectory } from '@/api/employees.api'

export function useEmployeeDirectory() {
  return useQuery({ queryKey: ['employees', 'directory'], queryFn: listEmployeeDirectory, staleTime: 60_000 })
}
