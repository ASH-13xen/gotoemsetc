import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getFlagHistory, getFlagPeople, getFlagsGiven, giveFlag, listEmployeeDirectory, listOpenEmployeeDirectory, type FlagColor } from '@/api/employees.api'

export function useEmployeeDirectory() {
  return useQuery({ queryKey: ['employees', 'directory'], queryFn: listEmployeeDirectory, staleTime: 60_000 })
}

// Backed by the permission-free GET /employees/directory — usable by any
// authenticated account, including ceo/operations_manager. See Office Keys.
export function useOpenEmployeeDirectory() {
  return useQuery({ queryKey: ['employees', 'open-directory'], queryFn: listOpenEmployeeDirectory, staleTime: 60_000 })
}

export function useFlagHistory(enabled = true) {
  return useQuery({ queryKey: ['employees', 'flag-history'], queryFn: getFlagHistory, enabled })
}

export function useFlagsGiven(enabled = true) {
  return useQuery({ queryKey: ['employees', 'flags-given'], queryFn: getFlagsGiven, enabled })
}

export function useFlagPeople() {
  return useQuery({ queryKey: ['employees', 'flag-people'], queryFn: getFlagPeople, staleTime: 60_000 })
}

export function useGiveFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, color, note }: { employeeId: string; color: FlagColor; note: string }) => giveFlag(employeeId, { color, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', 'flag-history'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'flags-given'] })
    },
  })
}
