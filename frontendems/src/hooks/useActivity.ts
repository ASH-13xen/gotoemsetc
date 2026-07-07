import { useQuery } from '@tanstack/react-query'
import * as activityApi from '@/api/activity.api'

export function useActivity(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['activity', employeeId],
    queryFn: () => activityApi.listActivity(employeeId as string),
    enabled: Boolean(employeeId),
  })
}
