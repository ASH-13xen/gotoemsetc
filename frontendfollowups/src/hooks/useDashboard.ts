import { useQuery } from '@tanstack/react-query'
import { getFollowupsStats } from '@/api/dashboard.api'

export function useFollowupsStats() {
  return useQuery({
    queryKey: ['dashboard', 'followups'],
    queryFn: getFollowupsStats,
  })
}
