import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as api from '@/api/companyEvents.api'

const KEY = (clientId: string) => ['company-events', 'client', clientId]

export function useClientEvents(clientId: string) {
  return useQuery({ queryKey: KEY(clientId), queryFn: () => api.listEventsForClient(clientId) })
}

export function useCreateClientEvent(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.createClientEvent>[0], 'clientId'>) =>
      api.createClientEvent({ ...input, clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(clientId) })
      toast.success('Date added')
    },
    onError: () => toast.error('Could not add this date'),
  })
}

export function useDeleteClientEvent(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(clientId) }),
    onError: () => toast.error('Could not remove this date'),
  })
}
