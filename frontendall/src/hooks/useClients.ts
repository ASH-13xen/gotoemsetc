import { useQuery } from '@tanstack/react-query'
import { listClients } from '@/api/clients.api'

export function useClientDirectory() {
  return useQuery({ queryKey: ['clients', 'directory'], queryFn: listClients, staleTime: 60_000 })
}
