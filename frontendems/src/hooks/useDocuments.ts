import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as documentsApi from '@/api/documents.api'

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['documents', employeeId],
    queryFn: () => documentsApi.listEmployeeDocuments(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export function useGenerateDocuments(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      templateIds,
      overrides,
    }: {
      templateIds: string[]
      overrides: Record<string, unknown>
    }) => documentsApi.generateDocuments(employeeId, templateIds, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] })
    },
  })
}

export function useDeleteDocument(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] })
    },
  })
}
