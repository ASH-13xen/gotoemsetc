import { useQuery } from '@tanstack/react-query'
import * as dashboardApi from '@/api/dashboard.api'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: dashboardApi.getDashboardStats,
  })
}
