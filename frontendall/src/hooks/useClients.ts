import { useQuery } from '@tanstack/react-query'
import { listClients, listClientTasks } from '@/api/clients.api'

export function useClientDirectory() {
  return useQuery({ queryKey: ['clients', 'directory'], queryFn: listClients, staleTime: 60_000 })
}

export function useClientTasks(clientId: string | undefined) {
  return useQuery({
    queryKey: ['clients', clientId, 'tasks'],
    queryFn: () => listClientTasks(clientId as string),
    enabled: Boolean(clientId),
    retry: false,
  })
}
