import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as credentialsApi from '@/api/credentials.api'
import type { Permission } from '@/api/credentials.api'

const CREDENTIALS_KEY = ['credentials']

export function useEmployeeCredential(employeeId: string) {
  return useQuery({
    queryKey: [...CREDENTIALS_KEY, employeeId],
    queryFn: () => credentialsApi.getCredentialForEmployee(employeeId),
    enabled: Boolean(employeeId),
  })
}

export function useCreateCredential(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { username: string; password: string; permissions?: Permission[] }) =>
      credentialsApi.createCredential(employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...CREDENTIALS_KEY, employeeId] })
    },
  })
}

export function useUpdateCredential(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      userId,
      ...input
    }: {
      userId: string
      username?: string
      password?: string
      permissions?: Permission[]
    }) => credentialsApi.updateCredential(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...CREDENTIALS_KEY, employeeId] })
    },
  })
}

export function useDeleteCredential(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => credentialsApi.deleteCredential(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...CREDENTIALS_KEY, employeeId] })
    },
  })
}
