import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as keysApi from '@/api/keys.api'
import type { OfficeKey } from '@/api/keys.api'

const KEY = ['office-keys']

export function useKeys() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => keysApi.listKeys(),
  })
}

export function useAssignKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ key, employeeIds }: { key: OfficeKey; employeeIds: string[] }) =>
      keysApi.assignKeyHolders(key, employeeIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
