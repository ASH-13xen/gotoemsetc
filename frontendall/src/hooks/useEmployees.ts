import { useQuery } from '@tanstack/react-query'
import { getFlagHistory, listEmployeeDirectory, listOpenEmployeeDirectory } from '@/api/employees.api'

export function useEmployeeDirectory() {
  return useQuery({ queryKey: ['employees', 'directory'], queryFn: listEmployeeDirectory, staleTime: 60_000 })
}

// Backed by the permission-free GET /employees/directory — usable by any
// authenticated account, including ceo/operations_manager. See Office Keys.
export function useOpenEmployeeDirectory() {
  return useQuery({ queryKey: ['employees', 'open-directory'], queryFn: listOpenEmployeeDirectory, staleTime: 60_000 })
}

export function useFlagHistory() {
  return useQuery({ queryKey: ['employees', 'flag-history'], queryFn: getFlagHistory })
}
