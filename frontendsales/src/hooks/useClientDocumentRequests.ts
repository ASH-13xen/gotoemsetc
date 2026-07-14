import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/clientDocumentRequests.api'

export function useClientDocumentRequests(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-document-requests', clientId],
    queryFn: () => api.listDocumentRequests(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useCreateDocumentRequest(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestedDocTypes, expiresInHours }: { requestedDocTypes: string[]; expiresInHours?: number }) =>
      api.createDocumentRequest(clientId, requestedDocTypes, expiresInHours),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-document-requests', clientId] }),
  })
}

export function useRevokeDocumentRequest(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revokeDocumentRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-document-requests', clientId] }),
  })
}

export function useClientUploadedDocuments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-uploaded-documents', clientId],
    queryFn: () => api.listUploadedDocuments(clientId as string),
    enabled: Boolean(clientId),
  })
}

export function useDeleteUploadedDocument(clientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteUploadedDocument(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-uploaded-documents', clientId] }),
  })
}
