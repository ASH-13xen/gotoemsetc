import { useQuery } from '@tanstack/react-query'
import * as documentsApi from '@/api/documents.api'

export function useMyDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-documents', employeeId],
    queryFn: () => documentsApi.listMyDocuments(employeeId as string),
    enabled: Boolean(employeeId),
  })
}
