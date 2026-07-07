import { apiClient } from './client'

export type UploadRequestStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'revoked'

export interface UploadRequest {
  _id: string
  employee: string
  requestedDocTypes: string[]
  status: UploadRequestStatus
  expiresAt: string
  fulfilledAt?: string
  createdAt: string
}

export interface UploadedDocument {
  _id: string
  employee: string
  uploadRequest: string
  docType: string
  originalFilename?: string
  mimeType?: string
  sizeBytes?: number
  url: string
  createdAt: string
}

export async function createUploadRequest(
  employeeId: string,
  requestedDocTypes: string[],
  expiresInHours?: number
): Promise<{ uploadRequest: UploadRequest; link: string }> {
  const { data } = await apiClient.post(`/employees/${employeeId}/upload-requests`, {
    requestedDocTypes,
    expiresInHours,
  })
  return data
}

export async function listUploadRequests(
  employeeId: string
): Promise<{ uploadRequests: UploadRequest[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/upload-requests`)
  return data
}

export async function revokeUploadRequest(id: string): Promise<void> {
  await apiClient.post(`/upload-requests/${id}/revoke`)
}

export async function listUploadedDocuments(
  employeeId: string
): Promise<{ uploadedDocuments: UploadedDocument[] }> {
  const { data } = await apiClient.get(`/employees/${employeeId}/uploaded-documents`)
  return data
}

export async function deleteUploadedDocument(id: string): Promise<void> {
  await apiClient.delete(`/uploaded-documents/${id}`)
}
