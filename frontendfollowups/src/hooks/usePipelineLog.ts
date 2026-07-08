import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as pipelineLogApi from '@/api/pipelineLog.api'
import type { CreatePipelineLogInput } from '@/api/pipelineLog.api'

export function usePipelineLog(clientId: string | undefined) {
  return useQuery({
    queryKey: ['pipeline-log', clientId],
    queryFn: () => pipelineLogApi.getPipelineLog(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useCreatePipelineLogEntry(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreatePipelineLogInput, 'client'>) =>
      pipelineLogApi.createPipelineLogEntry({ ...input, client: clientId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-log', clientId] }),
  })
}
