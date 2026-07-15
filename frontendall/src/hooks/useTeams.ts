import { useQuery } from '@tanstack/react-query'
import { listTeams } from '@/api/teams.api'

export function useTeams() {
  return useQuery({ queryKey: ['teams'], queryFn: listTeams, staleTime: 60_000 })
}
