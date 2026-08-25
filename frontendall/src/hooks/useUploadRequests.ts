import { useQuery } from '@tanstack/react-query'
import * as uploadRequestsApi from '@/api/uploadRequests.api'

export function useMyUploadRequests(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-upload-requests', employeeId],
    queryFn: () => uploadRequestsApi.listMyUploadRequests(employeeId as string),
    enabled: Boolean(employeeId),
  })
}
