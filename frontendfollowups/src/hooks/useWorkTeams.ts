import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as workTeamsApi from '@/api/workTeams.api'
import type { WorkTeamInput } from '@/api/workTeams.api'

const KEY = ['work-teams']

export function useWorkTeams() {
  return useQuery({ queryKey: KEY, queryFn: () => workTeamsApi.listWorkTeams() })
}

export function useWorkTeam(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => workTeamsApi.getWorkTeam(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateWorkTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WorkTeamInput) => workTeamsApi.createWorkTeam(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateWorkTeam(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<WorkTeamInput>) => workTeamsApi.updateWorkTeam(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteWorkTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workTeamsApi.deleteWorkTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
