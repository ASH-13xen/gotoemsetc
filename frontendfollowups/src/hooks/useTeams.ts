import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as teamsApi from '@/api/teams.api'
import type { CreateTeamInput, UpdateTeamInput } from '@/api/teams.api'

const TEAMS_KEY = ['teams']

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_KEY,
    queryFn: () => teamsApi.listTeams(),
  })
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: [...TEAMS_KEY, id],
    queryFn: () => teamsApi.getTeam(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTeamInput) => teamsApi.createTeam(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAMS_KEY }),
  })
}

export function useUpdateTeam(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTeamInput) => teamsApi.updateTeam(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAMS_KEY }),
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => teamsApi.deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEAMS_KEY }),
  })
}
