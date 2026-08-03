import { useQuery } from '@tanstack/react-query'
import * as workTeamsApi from '@/api/workTeams.api'

export function useWorkTeams() {
  return useQuery({ queryKey: ['work-teams'], queryFn: () => workTeamsApi.listWorkTeams() })
}
