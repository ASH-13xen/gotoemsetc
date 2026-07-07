import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as uploadRequestsApi from '@/api/uploadRequests.api'

export function useUploadRequests(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['uploadRequests', employeeId],
    queryFn: () => uploadRequestsApi.listUploadRequests(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export function useUploadedDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['uploadedDocuments', employeeId],
    queryFn: () => uploadRequestsApi.listUploadedDocuments(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export function useCreateUploadRequest(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      requestedDocTypes,
      expiresInHours,
    }: {
      requestedDocTypes: string[]
      expiresInHours?: number
    }) => uploadRequestsApi.createUploadRequest(employeeId, requestedDocTypes, expiresInHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploadRequests', employeeId] })
    },
  })
}

export function useRevokeUploadRequest(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => uploadRequestsApi.revokeUploadRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploadRequests', employeeId] })
    },
  })
}

export function useDeleteUploadedDocument(employeeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => uploadRequestsApi.deleteUploadedDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploadedDocuments', employeeId] })
    },
  })
}
