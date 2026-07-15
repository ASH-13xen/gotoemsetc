import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as clientChatApi from '@/api/clientChat.api'

export function useClientChatMessages(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-chat-messages', clientId],
    queryFn: () => clientChatApi.listClientChatMessages(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function usePostClientChatMessage(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => clientChatApi.postClientChatMessage(clientId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-chat-messages', clientId] }),
  })
}

export function useUpdateClientChatAccess(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (employeeIds: string[]) => clientChatApi.updateClientChatAccess(clientId, employeeIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients', clientId] }),
  })
}
