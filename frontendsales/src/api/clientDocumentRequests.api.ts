import { apiClient } from './client'

export type DocumentRequestStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'revoked'

export interface ClientDocumentRequest {
  _id: string
  client: string
  requestedDocTypes: string[]
  status: DocumentRequestStatus
  expiresAt: string
  fulfilledAt?: string
  createdAt: string
  link: string
  accessCode: string | null
}

export interface ClientUploadedDocument {
  _id: string
  client: string
  clientDocumentRequest: string
  slotIndex: number
  docLabel: string
  originalFilename?: string
  mimeType?: string
  sizeBytes?: number
  createdAt: string
}

export async function createDocumentRequest(
  clientId: string,
  requestedDocTypes: string[],
  expiresInHours?: number
): Promise<{ request: ClientDocumentRequest }> {
  const { data } = await apiClient.post(`/clients/${clientId}/document-requests`, {
    requestedDocTypes,
    expiresInHours,
  })
  return data
}

export async function listDocumentRequests(
  clientId: string
): Promise<{ requests: ClientDocumentRequest[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/document-requests`)
  return data
}

export async function revokeDocumentRequest(id: string): Promise<void> {
  await apiClient.post(`/client-document-requests/${id}/revoke`)
}

export async function listUploadedDocuments(
  clientId: string
): Promise<{ documents: ClientUploadedDocument[] }> {
  const { data } = await apiClient.get(`/clients/${clientId}/uploaded-documents`)
  return data
}

export async function deleteUploadedDocument(id: string): Promise<void> {
  await apiClient.delete(`/client-uploaded-documents/${id}`)
}

// Admin-gated download, same blob pattern used across the app.
export async function downloadUploadedDocument(id: string, filename: string): Promise<void> {
  const { data } = await apiClient.get(`/client-uploaded-documents/${id}/file`, { responseType: 'blob' })
  const url = window.URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
