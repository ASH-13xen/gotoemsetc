import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as clientsApi from '@/api/clients.api'
import type { ContactInput, ListClientsParams, RegisterClientInput } from '@/api/clients.api'

const CLIENTS_KEY = ['clients']

export function useClients(params: ListClientsParams) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, params],
    queryFn: () => clientsApi.listClients(params),
    placeholderData: (prev) => prev,
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, id],
    queryFn: () => clientsApi.getClient(id as string),
    enabled: Boolean(id),
  })
}

export function useRegisterClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterClientInput) => clientsApi.registerClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  })
}

export function useAddContact(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ContactInput) => clientsApi.addContact(clientId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY, clientId] }),
  })
}

export function useRemoveContact(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => clientsApi.removeContact(clientId, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY, clientId] }),
  })
}

export function useOffboardClient(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clientsApi.offboardClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY, clientId] })
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
    },
  })
}
