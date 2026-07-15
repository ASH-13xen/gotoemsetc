import { useQuery } from '@tanstack/react-query'
import * as devicePunchesApi from '@/api/devicePunches.api'

export function useDevicePunches(params?: { limit?: number; employeeId?: string }) {
  return useQuery({
    queryKey: ['device-punches', params],
    queryFn: () => devicePunchesApi.listDevicePunches(params),
    refetchInterval: 30000,
  })
}
