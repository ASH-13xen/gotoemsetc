import { useQuery } from '@tanstack/react-query'
import * as activityApi from '@/api/activity.api'

export function useActivity(clientId: string | undefined) {
  return useQuery({
    queryKey: ['activity', clientId],
    queryFn: () => activityApi.listActivity(clientId as string),
    enabled: Boolean(clientId),
  })
}
